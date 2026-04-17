import type { Match, TiebreakerKey } from '@/lib/firestore/types';

export interface StandingRow {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  groupId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** 1-indexed rank after tiebreakers (set by the caller, not this fn). */
  rank: number;
}

/**
 * Pure client-side standings calculator. Takes the finished matches in a
 * tournament plus the list of teams, returns one row per team with points
 * and aggregate stats. Rank is set by the caller (sort + tiebreakers).
 *
 * Points rule: 3 for a win, 1 for a draw, 0 for a loss. We ignore
 * `abandoned` matches per SPEC §10 unless the admin has overridden.
 */
export function computeStandings(params: {
  teams: { id: string; name: string; logoUrl?: string; groupId: string }[];
  matches: Match[];
}): StandingRow[] {
  const { teams, matches } = params;
  const rows = new Map<string, StandingRow>();
  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      teamLogoUrl: t.logoUrl,
      groupId: t.groupId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      rank: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== 'finished' || m.phase !== 'group') continue;
    const a = rows.get(m.teamA.teamId);
    const b = rows.get(m.teamB.teamId);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;
    a.goalsFor += m.score.a;
    a.goalsAgainst += m.score.b;
    b.goalsFor += m.score.b;
    b.goalsAgainst += m.score.a;
    if (m.score.a > m.score.b) {
      a.wins += 1;
      b.losses += 1;
      a.points += 3;
    } else if (m.score.a < m.score.b) {
      b.wins += 1;
      a.losses += 1;
      b.points += 3;
    } else {
      a.draws += 1;
      b.draws += 1;
      a.points += 1;
      b.points += 1;
    }
  }

  for (const r of rows.values()) {
    r.goalDifference = r.goalsFor - r.goalsAgainst;
  }

  return [...rows.values()];
}

/**
 * Sort standings within a group using the tournament's tiebreaker order.
 * H2H (head-to-head) resolves ties between exactly two teams by looking
 * at the match(es) they played against each other; ties among 3+ teams
 * on H2H fall through to the next tiebreaker.
 */
export function sortStandings(params: {
  standings: StandingRow[];
  matches: Match[];
  order: TiebreakerKey[];
}): StandingRow[] {
  const { standings, matches, order } = params;
  const finishedGroup = matches.filter((m) => m.status === 'finished' && m.phase === 'group');

  const sorted = [...standings].sort((x, y) => {
    if (x.points !== y.points) return y.points - x.points;
    for (const key of order) {
      const cmp = compareByKey(x, y, key, finishedGroup);
      if (cmp !== 0) return cmp;
    }
    return x.teamName.localeCompare(y.teamName, 'sr');
  });

  sorted.forEach((row, idx) => {
    row.rank = idx + 1;
  });
  return sorted;
}

function compareByKey(
  x: StandingRow,
  y: StandingRow,
  key: TiebreakerKey,
  matches: Match[],
): number {
  switch (key) {
    case 'gd':
      return y.goalDifference - x.goalDifference;
    case 'gf':
      return y.goalsFor - x.goalsFor;
    case 'ga':
      return x.goalsAgainst - y.goalsAgainst; // fewer is better
    case 'h2h': {
      // Look at finished matches between these two teams only.
      let xPts = 0;
      let yPts = 0;
      let xGf = 0;
      let yGf = 0;
      for (const m of matches) {
        const inv = [m.teamA.teamId, m.teamB.teamId];
        if (!inv.includes(x.teamId) || !inv.includes(y.teamId)) continue;
        const xIsA = m.teamA.teamId === x.teamId;
        const xGoals = xIsA ? m.score.a : m.score.b;
        const yGoals = xIsA ? m.score.b : m.score.a;
        xGf += xGoals;
        yGf += yGoals;
        if (xGoals > yGoals) xPts += 3;
        else if (xGoals < yGoals) yPts += 3;
        else {
          xPts += 1;
          yPts += 1;
        }
      }
      if (xPts !== yPts) return yPts - xPts;
      return yGf - xGf;
    }
  }
}
