import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, Pencil, X } from 'lucide-react';

import type { Group, Match, Team, TiebreakerKey } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { softDeleteTeam, updateTeam } from '@/features/team/teamActions';
import { deleteTeamRoster } from '@/features/player/playerActions';
import { setGroupManualOrder } from '@/features/tournament/tournamentActions';
import { computeStandings, sortStandings } from '@/lib/utils/standings';

interface Props {
  tournamentId: string;
  teams: Team[];
  groups: Group[];
  matches: Match[];
  tiebreakerOrder: TiebreakerKey[];
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
export function TeamList({
  tournamentId,
  teams,
  groups,
  matches,
  tiebreakerOrder,
  onEdit,
}: Props) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderingGroup, setOrderingGroup] = useState<Group | null>(null);

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
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-600 text-ink-secondary">{g.name}</h3>
              {list.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setOrderingGroup(g)}
                  className="inline-flex items-center gap-1 rounded-md border border-surface-4 px-2 py-1 text-xs text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
                  title="Postavi konačan redosled u tabeli"
                >
                  <ListOrdered size={14} />
                  Redosled u tabeli
                  {g.manualOrder?.length ? (
                    <span className="ml-1 rounded-full bg-brand-600/20 px-1.5 text-[0.65rem] font-700 text-brand-300">
                      ručno
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>
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

      {orderingGroup ? (
        <GroupOrderModal
          tournamentId={tournamentId}
          group={orderingGroup}
          teams={teams.filter((t) => t.groupId === orderingGroup.id)}
          matches={matches}
          tiebreakerOrder={tiebreakerOrder}
          onClose={() => setOrderingGroup(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Up/Down reorder list for a single group. Seeds from the live computed
 * standings — i.e. exactly what the public /grupe table is showing
 * right now (points + tiebreakers + existing manualOrder if any). The
 * admin tweaks from there. Save writes `Group.manualOrder`; Auto-sort
 * clears the override back to pure auto.
 */
function GroupOrderModal({
  tournamentId,
  group,
  teams,
  matches,
  tiebreakerOrder,
  onClose,
}: {
  tournamentId: string;
  group: Group;
  teams: Team[];
  matches: Match[];
  tiebreakerOrder: TiebreakerKey[];
  onClose: () => void;
}) {
  const liveRows = (() => {
    const raw = computeStandings({ teams, matches });
    return sortStandings({
      standings: raw,
      matches,
      order: tiebreakerOrder,
      manualOrder: group.manualOrder,
    });
  })();
  const statsByTeam = new Map(liveRows.map((r) => [r.teamId, r]));
  const initial: Team[] = (() => {
    const byId = new Map(teams.map((t) => [t.id, t]));
    return liveRows
      .map((r) => byId.get(r.teamId))
      .filter((t): t is Team => !!t);
  })();
  const [order, setOrder] = useState<Team[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function move(idx: number, delta: number) {
    const j = idx + delta;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await setGroupManualOrder(
        tournamentId,
        group.id,
        order.map((t) => t.id),
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await setGroupManualOrder(tournamentId, group.id, null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-md flex-col rounded-t-2xl bg-surface-1 shadow-elevated sm:rounded-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-3 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[0.65rem] uppercase tracking-wide text-ink-tertiary">
              Redosled u tabeli
            </span>
            <span className="font-display text-base font-700 text-ink-primary">
              {group.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-ink-secondary hover:bg-surface-2"
            aria-label={sr.common.close}
          >
            <X size={18} />
          </button>
        </header>

        <ol className="flex flex-col gap-2 px-3 py-3">
          {order.map((t, i) => {
            const stats = statsByTeam.get(t.id);
            return (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2"
              >
                <span className="tnum w-6 text-sm font-700 text-ink-secondary">
                  {i + 1}.
                </span>
                <span className="flex-1 truncate text-sm text-ink-primary">{t.name}</span>
                {stats ? (
                  <span className="tnum text-xs text-ink-tertiary">
                    {stats.points} bod · GR{' '}
                    {stats.goalDifference > 0
                      ? `+${stats.goalDifference}`
                      : stats.goalDifference}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={busy || i === 0}
                  className="rounded-md p-2 text-ink-secondary hover:bg-surface-3 disabled:opacity-40"
                  aria-label="Pomeri gore"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={busy || i === order.length - 1}
                  className="rounded-md p-2 text-ink-secondary hover:bg-surface-3 disabled:opacity-40"
                  aria-label="Pomeri dole"
                >
                  <ArrowDown size={16} />
                </button>
              </li>
            );
          })}
        </ol>

        {error ? (
          <p className="mx-4 mb-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 border-t border-surface-3 px-4 py-3">
          <button
            type="button"
            onClick={() => void reset()}
            disabled={busy || !group.manualOrder?.length}
            className="h-touch flex-1 rounded-md border border-surface-4 text-sm font-600 text-ink-secondary hover:bg-surface-2 disabled:opacity-60"
          >
            Auto-sort
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="h-touch flex-1 rounded-md bg-brand-600 text-sm font-700 text-ink-primary disabled:opacity-60"
          >
            {sr.common.save}
          </button>
        </div>
      </div>
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
