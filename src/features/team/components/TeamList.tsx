import { useState } from 'react';
import { Pencil } from 'lucide-react';

import type { Group, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { softDeleteTeam } from '@/features/team/teamActions';
import { deleteTeamRoster } from '@/features/player/playerActions';

interface Props {
  tournamentId: string;
  teams: Team[];
  groups: Group[];
  onEdit: (team: Team) => void;
}

export function TeamList({ tournamentId, teams, groups, onEdit }: Props) {
  if (teams.length === 0) {
    return (
      <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-secondary">
        {sr.admin.teams.empty}
      </p>
    );
  }

  const byGroup = new Map<string, Team[]>();
  for (const t of teams) {
    const list = byGroup.get(t.groupId) ?? [];
    list.push(t);
    byGroup.set(t.groupId, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        const list = byGroup.get(g.id) ?? [];
        return (
          <section key={g.id} className="flex flex-col gap-2">
            <h3 className="font-display text-sm font-600 text-ink-secondary">{g.name}</h3>
            {list.length === 0 ? (
              <p className="rounded-md bg-surface-1 px-4 py-3 text-xs text-ink-tertiary">
                Nema timova u ovoj grupi.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    tournamentId={tournamentId}
                    onEdit={() => onEdit(team)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TeamRow({
  tournamentId,
  team,
  onEdit,
}: {
  tournamentId: string;
  team: Team;
  onEdit: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`Obrisati tim "${team.name}" i sve igrače?`)) return;
    setBusy(true);
    try {
      await deleteTeamRoster(tournamentId, team.id);
      await softDeleteTeam(tournamentId, team.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card">
      <div className="flex items-center gap-3">
        {team.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} className="h-8 w-8 rounded" />
        ) : (
          <div
            className="h-8 w-8 rounded"
            style={{ backgroundColor: team.color ?? 'var(--color-surface-3)' }}
          />
        )}
        <div className="flex flex-col">
          <span className="font-500 text-ink-primary">{team.name}</span>
          {team.captainName ? (
            <span className="text-xs text-ink-tertiary">Kapiten: {team.captainName}</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md border border-surface-4 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
        >
          <Pencil size={14} />
          {sr.common.edit}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="rounded-md border border-surface-4 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
        >
          {sr.common.delete}
        </button>
      </div>
    </li>
  );
}
