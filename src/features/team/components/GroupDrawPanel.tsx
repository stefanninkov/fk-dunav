import { useState } from 'react';
import { Dices, RotateCcw } from 'lucide-react';

import type { Group, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  drawNextTeamToGroup,
  resetGroupDraw,
} from '@/features/team/groupDrawActions';

interface Props {
  tournamentId: string;
  groups: Group[];
  teams: Team[];
}

/**
 * Admin sub-section on /admin/timovi. Shows the unassigned-team pool,
 * per-group head counts, and the draw controls. Each "Izvuci sledeći
 * tim" picks a random unassigned team and seeds it into the group with
 * the fewest current members.
 */
export function GroupDrawPanel({ tournamentId, groups, teams }: Props) {
  const uid = useAuthStore((s) => s.uid);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTeams = teams.filter((t) => !t.deletedAt);
  const unassigned = activeTeams.filter((t) => !t.groupId);
  const perGroup = new Map<string, number>();
  for (const g of groups) perGroup.set(g.id, 0);
  for (const t of activeTeams) {
    if (t.groupId && perGroup.has(t.groupId)) {
      perGroup.set(t.groupId, (perGroup.get(t.groupId) ?? 0) + 1);
    }
  }

  async function draw() {
    if (!uid) return;
    setDrawing(true);
    setError(null);
    try {
      const result = await drawNextTeamToGroup(tournamentId, uid);
      if (!result) setError(sr.admin.teams.drawAllAssigned);
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setDrawing(false);
    }
  }

  async function doReset() {
    if (!confirm(sr.admin.teams.drawResetConfirm)) return;
    await resetGroupDraw(tournamentId);
  }

  const canDraw = groups.length > 0 && unassigned.length > 0 && !drawing;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-surface-4 bg-surface-1/70 p-4">
      <header>
        <h2 className="font-display text-lg font-600">
          {sr.admin.teams.drawTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          {sr.admin.teams.drawHelp}
        </p>
      </header>

      {/* Group head counts */}
      {groups.length === 0 ? (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-xs italic text-ink-tertiary">
          {sr.admin.teams.drawNoGroups}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs"
            >
              <span className="font-600 text-ink-primary">{g.name}</span>
              <span className="tnum text-ink-tertiary">
                {perGroup.get(g.id) ?? 0}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Unassigned team list */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-ink-tertiary">
          {sr.admin.teams.drawUnassignedTitle}
          <span className="tnum ml-2">
            {unassigned.length} {unassigned.length === 1 ? 'tim' : 'timova'}
          </span>
        </span>
        {unassigned.length === 0 ? (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-xs italic text-ink-tertiary">
            {sr.admin.teams.drawAllAssigned}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {unassigned.map((t) => (
              <li
                key={t.id}
                className="rounded-md bg-surface-2 px-2.5 py-1 text-xs text-ink-primary"
              >
                {t.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void draw()}
          disabled={!canDraw}
          className="inline-flex items-center gap-2 rounded-md bg-accent-gold px-4 py-2 text-sm font-700 text-ink-inverse hover:opacity-90 disabled:opacity-50"
        >
          <Dices size={16} />
          {sr.admin.teams.drawNext}
        </button>
        <button
          type="button"
          onClick={() => void doReset()}
          className="inline-flex items-center gap-2 rounded-md border border-surface-4 px-3 py-2 text-xs text-ink-secondary hover:bg-surface-2"
        >
          <RotateCcw size={14} />
          {sr.admin.teams.drawReset}
        </button>
      </div>
    </section>
  );
}
