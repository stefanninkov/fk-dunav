import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { groupsCol, matchesCol, teamsCol } from '@/lib/firestore/refs';
import type { Group, Match, Team } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import {
  computeLockedRanks,
  computeStandings,
  sortStandings,
  type StandingRow,
} from '@/lib/utils/standings';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

/**
 * Day-2 timetable for the knockout phase + the side events that share
 * the day. Each row is a time slot with up to two field cells; cells can
 * be a knockout match (auto-filled from group standings + propagated
 * bracket winners) or a side event with no field assignment.
 *
 * Auto-fill rules for the placeholder labels:
 *  - "1A" / "2A" / "3A" / "4A" → the team ranked Nth in Grupa A
 *    (group order index 0). 1B → Grupa B (order 1), etc.
 *  - "pob. ČF1" → the winner of the QF1 bracket slot once that match
 *    finishes. Until then the placeholder shows.
 *  - "por. PF1" → the loser of the SF1 slot.
 *
 * If the admin manually creates the knockout match doc with bracketSlot
 * set, its actual teamA/teamB snapshots override the auto-computed
 * labels — and propagateBracketWinner fills in SF + final teams as
 * matches finish.
 */

// ---------------------------------------------------------------------------
// Day-2 template

type SourceRef =
  | { type: 'standing'; position: number; groupLetter: string }
  | { type: 'derived'; sourceSlot: string; role: 'winner' | 'loser' };

interface MatchCell {
  kind: 'match';
  /** Internal bracket slot id matching the Firestore doc's bracketSlot. */
  slot: 'QF1' | 'QF2' | 'QF3' | 'QF4' | 'SF1' | 'SF2' | 'TP' | 'FINAL';
  /** Short Serbian abbreviation shown before the team names. */
  label: string;
  teamA: SourceRef;
  teamB: SourceRef;
}

interface EventCell {
  kind: 'event';
  label: string;
}

type Cell = MatchCell | EventCell | null;

interface ScheduleRow {
  time: string;
  field1: Cell;
  field2: Cell;
}

const SCHEDULE: ScheduleRow[] = [
  {
    time: '11:00',
    field1: {
      kind: 'match',
      slot: 'QF1',
      label: 'ČF1',
      teamA: { type: 'standing', position: 1, groupLetter: 'A' },
      teamB: { type: 'standing', position: 4, groupLetter: 'B' },
    },
    field2: {
      kind: 'match',
      slot: 'QF2',
      label: 'ČF2',
      teamA: { type: 'standing', position: 1, groupLetter: 'B' },
      teamB: { type: 'standing', position: 4, groupLetter: 'A' },
    },
  },
  {
    time: '12:00',
    field1: {
      kind: 'match',
      slot: 'QF3',
      label: 'ČF3',
      teamA: { type: 'standing', position: 2, groupLetter: 'A' },
      teamB: { type: 'standing', position: 3, groupLetter: 'B' },
    },
    field2: {
      kind: 'match',
      slot: 'QF4',
      label: 'ČF4',
      teamA: { type: 'standing', position: 2, groupLetter: 'B' },
      teamB: { type: 'standing', position: 3, groupLetter: 'A' },
    },
  },
  {
    time: '13:00',
    field1: { kind: 'event', label: 'Gađanje prečke bosom nogom (kvalifikacije)' },
    field2: null,
  },
  {
    time: '14:00',
    field1: {
      kind: 'match',
      slot: 'SF1',
      label: 'PF1',
      teamA: { type: 'derived', sourceSlot: 'QF1', role: 'winner' },
      teamB: { type: 'derived', sourceSlot: 'QF4', role: 'winner' },
    },
    field2: null,
  },
  {
    time: '15:00',
    field1: {
      kind: 'match',
      slot: 'SF2',
      label: 'PF2',
      teamA: { type: 'derived', sourceSlot: 'QF2', role: 'winner' },
      teamB: { type: 'derived', sourceSlot: 'QF3', role: 'winner' },
    },
    field2: null,
  },
  {
    time: '16:00',
    field1: { kind: 'event', label: 'Finale gađanja prečke' },
    field2: null,
  },
  {
    time: '17:00',
    field1: {
      kind: 'match',
      slot: 'TP',
      label: 'Utakmica za 3. mesto',
      teamA: { type: 'derived', sourceSlot: 'SF1', role: 'loser' },
      teamB: { type: 'derived', sourceSlot: 'SF2', role: 'loser' },
    },
    field2: null,
  },
  {
    time: '18:00',
    field1: { kind: 'event', label: 'Revijalna utakmica (veterani)' },
    field2: null,
  },
  {
    time: '19:00',
    field1: {
      kind: 'match',
      slot: 'FINAL',
      label: 'FINALE',
      teamA: { type: 'derived', sourceSlot: 'SF1', role: 'winner' },
      teamB: { type: 'derived', sourceSlot: 'SF2', role: 'winner' },
    },
    field2: null,
  },
];

// ---------------------------------------------------------------------------

export function KnockoutPage() {
  const active = useTournamentStore((s) => s.active);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsubGroups = onSnapshot(
      query(groupsCol(active.id), orderBy('order', 'asc')),
      (snap) => setGroups(snap.docs.map((d) => d.data())),
    );
    const unsubTeams = onSnapshot(
      query(teamsCol(active.id), where('deletedAt', '==', null)),
      (snap) => setTeams(snap.docs.map((d) => d.data())),
    );
    const unsubMatches = onSnapshot(matchesCol(active.id), (snap) =>
      setMatches(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubGroups();
      unsubTeams();
      unsubMatches();
    };
  }, [active]);

  // Per-group standings + the set of rank positions that are
  // mathematically locked given remaining matches. Keyed by group letter
  // (A, B, …) — group letter comes from group.order (0 → A, 1 → B, …).
  const groupInfoByLetter = useMemo(() => {
    const m = new Map<
      string,
      { standings: StandingRow[]; lockedRanks: Set<number> }
    >();
    if (!active || matches === null) return m;
    for (const g of groups) {
      const groupTeams = teams.filter((t) => !t.deletedAt && t.groupId === g.id);
      const raw = computeStandings({ teams: groupTeams, matches });
      const sorted = sortStandings({
        standings: raw,
        matches,
        order: active.config.tiebreakerOrder,
        // Honour the admin's manual override so the QF slots pair up
        // teams in the same order the public /grupe table is showing.
        manualOrder: g.manualOrder,
      });
      // If the admin pinned a manual order, they've effectively declared
      // the standings final — every rank is locked, so the team names
      // appear in the bracket slots immediately instead of "1A"/"2A".
      const lockedRanks = g.manualOrder?.length
        ? new Set(sorted.map((r) => r.rank))
        : computeLockedRanks(sorted, matches, g.id);
      m.set(letterForGroup(g), { standings: sorted, lockedRanks });
    }
    return m;
  }, [active, groups, teams, matches]);

  const knockoutBySlot = useMemo(() => {
    const m = new Map<string, Match>();
    for (const match of matches ?? []) {
      if (match.phase !== 'knockout' || !match.bracketSlot) continue;
      m.set(match.bracketSlot, match);
    }
    return m;
  }, [matches]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.knockout} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1100px] px-page-x py-10 lg:px-page-x-lg">
      <header>
        <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.knockout}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Raspored nedelje (drugi dan turnira). Timovi se automatski popunjavaju kad se
          završi grupna faza.
        </p>
      </header>

      <div className="mt-8 overflow-x-auto rounded-lg bg-surface-1 shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-3 text-xs uppercase tracking-wide text-ink-tertiary">
            <tr>
              <th className="px-4 py-3 text-left font-600">Vreme</th>
              <th className="px-4 py-3 text-left font-600">Teren 1</th>
              <th className="px-4 py-3 text-left font-600">Teren 2</th>
            </tr>
          </thead>
          <tbody>
            {SCHEDULE.map((row) => (
              <tr
                key={row.time}
                className="border-t border-surface-3 align-top first:border-t-0"
              >
                <td className="px-4 py-4 align-middle font-display text-base font-700 text-ink-primary tnum">
                  {row.time}
                </td>
                <td className="px-4 py-4 align-middle">
                  <CellView
                    cell={row.field1}
                    groupInfoByLetter={groupInfoByLetter}
                    knockoutBySlot={knockoutBySlot}
                  />
                </td>
                <td className="px-4 py-4 align-middle">
                  <CellView
                    cell={row.field2}
                    groupInfoByLetter={groupInfoByLetter}
                    knockoutBySlot={knockoutBySlot}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function CellView({
  cell,
  groupInfoByLetter,
  knockoutBySlot,
}: {
  cell: Cell;
  groupInfoByLetter: Map<
    string,
    { standings: StandingRow[]; lockedRanks: Set<number> }
  >;
  knockoutBySlot: Map<string, Match>;
}) {
  if (!cell) {
    return <span className="text-ink-tertiary">/</span>;
  }
  if (cell.kind === 'event') {
    return (
      <span className="text-ink-primary italic">{cell.label}</span>
    );
  }

  const actual = knockoutBySlot.get(cell.slot);
  // Always resolve from the source (group standings or upstream slot)
  // so we hide team names until they're mathematically certain — even
  // if the admin pre-created the knockout match doc with a real team
  // snapshot. The Firestore match still owns navigation; only the
  // labels are gated.
  const a = resolveSource(cell.teamA, groupInfoByLetter, knockoutBySlot);
  const b = resolveSource(cell.teamB, groupInfoByLetter, knockoutBySlot);

  const content = (
    <span className="text-ink-primary">
      <span className="font-700 text-brand-400">{cell.label}:</span>{' '}
      <span className="font-500">{a}</span>
      <span className="mx-2 text-ink-tertiary">vs</span>
      <span className="font-500">{b}</span>
      {actual?.status === 'finished' ? (
        <span className="ml-2 tnum text-ink-secondary">
          {actual.score.a}:{actual.score.b}
          {actual.shootoutScore
            ? ` (${actual.shootoutScore.a}:${actual.shootoutScore.b})`
            : ''}
        </span>
      ) : null}
    </span>
  );

  return actual ? (
    <NavLink
      to={`/utakmica/${actual.id}`}
      className="hover:text-ink-primary hover:underline"
    >
      {content}
    </NavLink>
  ) : (
    content
  );
}

// ---------------------------------------------------------------------------

function letterForGroup(g: Group): string {
  // Map group.order → A, B, C, … so the SCHEDULE template can reference
  // groups positionally without caring about the human-readable name.
  return String.fromCharCode('A'.charCodeAt(0) + Math.max(0, g.order));
}

function resolveSource(
  source: SourceRef,
  groupInfoByLetter: Map<
    string,
    { standings: StandingRow[]; lockedRanks: Set<number> }
  >,
  knockoutBySlot: Map<string, Match>,
): string {
  if (source.type === 'standing') {
    const info = groupInfoByLetter.get(source.groupLetter);
    const row = info?.standings.find((r) => r.rank === source.position);
    // Only swap the placeholder for a real team name if this rank is
    // mathematically locked (group fully played out OR the team's
    // position can't change no matter what's left to play).
    if (row && info?.lockedRanks.has(source.position)) {
      return row.teamName;
    }
    return `${source.position}${source.groupLetter}`;
  }

  // Derived from another slot's outcome.
  const sourceMatch = knockoutBySlot.get(source.sourceSlot);
  if (sourceMatch && sourceMatch.status === 'finished') {
    const aWon = sourceMatch.shootoutScore
      ? sourceMatch.shootoutScore.a > sourceMatch.shootoutScore.b
      : sourceMatch.score.a > sourceMatch.score.b;
    const winnerName = aWon ? sourceMatch.teamA.name : sourceMatch.teamB.name;
    const loserName = aWon ? sourceMatch.teamB.name : sourceMatch.teamA.name;
    return source.role === 'winner' ? winnerName : loserName;
  }
  const verb = source.role === 'winner' ? 'pob.' : 'por.';
  return `${verb} ${labelForSlot(source.sourceSlot)}`;
}

function labelForSlot(slot: string): string {
  if (slot === 'QF1') return 'ČF1';
  if (slot === 'QF2') return 'ČF2';
  if (slot === 'QF3') return 'ČF3';
  if (slot === 'QF4') return 'ČF4';
  if (slot === 'SF1') return 'PF1';
  if (slot === 'SF2') return 'PF2';
  if (slot === 'FINAL') return 'F';
  if (slot === 'TP') return 'TP';
  return slot;
}
