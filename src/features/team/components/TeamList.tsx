import { useState } from 'react';
import { GripVertical, Pencil } from 'lucide-react';

import type { Group, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { softDeleteTeam, updateTeam } from '@/features/team/teamActions';
import { deleteTeamRoster } from '@/features/player/playerActions';

interface Props {
  tournamentId: string;
  teams: Team[];
  groups: Group[];
  onEdit: (team: Team) => void;
}

const DRAG_TYPE = 'application/x-fk-dunav-team';

/**
 * Group-by-group team browser. Each team row is HTML5-draggable; each
 * section (a group + the unassigned bucket) is a drop target. Dropping
 * a team into a new section calls updateTeam with the new groupId.
 * Mobile users can still use Edit → group dropdown (native D&D is a
 * desktop-only convenience).
 */
export function TeamList({ tournamentId, teams, groups, onEdit }: Props) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (teams.length === 0) {
    return (
      <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-secondary">
        {sr.admin.teams.empty}
      </p>
    );
  }

  const byGroup = new Map<string, Team[]>();
  const unassigned: Team[] = [];
  for (const t of teams) {
    if (!t.groupId) {
      unassigned.push(t);
      continue;
    }
    const list = byGroup.get(t.groupId) ?? [];
    list.push(t);
    byGroup.set(t.groupId, list);
  }

  async function moveTo(teamId: string, newGroupId: string) {
    const team = teams.find((t) => t.id === teamId);
    if (!team || team.groupId === newGroupId) return;
    setBusy(true);
    try {
      await updateTeam(tournamentId, teamId, { groupId: newGroupId });
    } finally {
      setBusy(false);
    }
  }

  function dropProps(targetGroupId: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes(DRAG_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDragOver(targetGroupId);
        }
      },
      onDragLeave: () => {
        setDragOver((prev) => (prev === targetGroupId ? null : prev));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const teamId = e.dataTransfer.getData(DRAG_TYPE);
        setDragOver(null);
        if (teamId) void moveTo(teamId, targetGroupId);
      },
    };
  }

  function dropZoneCls(targetGroupId: string) {
    return dragOver === targetGroupId
      ? 'rounded-lg ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-0 transition-shadow'
      : 'rounded-lg transition-shadow';
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        className={`flex flex-col gap-2 ${dropZoneCls('')}`}
        {...dropProps('')}
      >
        <h3 className="font-display text-sm font-600 text-ink-secondary">
          {sr.admin.teams.form.unassigned}
        </h3>
        {unassigned.length === 0 ? (
          <p className="rounded-md bg-surface-1 px-4 py-3 text-xs text-ink-tertiary">
            Prevuci tim ovde da ga ukloniš iz grupe.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unassigned.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                tournamentId={tournamentId}
                onEdit={() => onEdit(team)}
                disabled={busy}
              />
            ))}
          </ul>
        )}
      </section>

      {groups.map((g) => {
        const list = byGroup.get(g.id) ?? [];
        return (
          <section
            key={g.id}
            className={`flex flex-col gap-2 ${dropZoneCls(g.id)}`}
            {...dropProps(g.id)}
          >
            <h3 className="font-display text-sm font-600 text-ink-secondary">{g.name}</h3>
            {list.length === 0 ? (
              <p className="rounded-md bg-surface-1 px-4 py-3 text-xs text-ink-tertiary">
                Prevuci tim ovde.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    tournamentId={tournamentId}
                    onEdit={() => onEdit(team)}
                    disabled={busy}
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
  disabled,
}: {
  tournamentId: string;
  team: Team;
  onEdit: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

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
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, team.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={`flex items-center justify-between gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card ${
        dragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="cursor-grab text-ink-tertiary hover:text-ink-secondary active:cursor-grabbing"
          aria-hidden="true"
          title="Prevuci za premeštanje"
        >
          <GripVertical size={16} />
        </span>
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
          disabled={busy || disabled}
          className="rounded-md border border-surface-4 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
        >
          {sr.common.delete}
        </button>
      </div>
    </li>
  );
}
