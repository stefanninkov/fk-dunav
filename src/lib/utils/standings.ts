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
 *
 * `manualOrder` (optional) is an admin override: a list of teamIds in
 * the desired final order. Teams that appear in it take that order;
 * any standings rows not listed fall to the bottom in autosort order.
 */
export function sortStandings(params: {
  standings: StandingRow[];
  matches: Match[];
  order: TiebreakerKey[];
  manualOrder?: string[];
}): StandingRow[] {
  const { standings, matches, order, manualOrder } = params;
  const finishedGroup = matches.filter((m) => m.status === 'finished' && m.phase === 'group');

  const auto = [...standings].sort((x, y) => {
    if (x.points !== y.points) return y.points - x.points;
    for (const key of order) {
      const cmp = compareByKey(x, y, key, finishedGroup);
      if (cmp !== 0) return cmp;
    }
    return x.teamName.localeCompare(y.teamName, 'sr');
  });

  let sorted = auto;
  if (manualOrder && manualOrder.length > 0) {
    const indexOf = new Map(manualOrder.map((id, i) => [id, i]));
    sorted = [...auto].sort((x, y) => {
      const xi = indexOf.get(x.teamId);
      const yi = indexOf.get(y.teamId);
      if (xi !== undefined && yi !== undefined) return xi - yi;
      if (xi !== undefined) return -1;
      if (yi !== undefined) return 1;
      return 0;
    });
  }

  sorted.forEach((row, idx) => {
    row.rank = idx + 1;
  });
  return sorted;
}

/**
 * Determine which rank positions in a group are mathematically locked
 * given the matches played so far. A rank is "locked" if the team
 * currently sitting in it is guaranteed to stay there regardless of how
 * the remaining group matches play out.
 *
 * The check is conservative (no tiebreakers):
 *  - Lower-ranked teams overtake T only if their MAX possible final
 *    points strictly exceed T's MIN. We require U.max < T.min for safety.
 *  - Higher-ranked teams fall below T only if their MIN points stay
 *    above T's MAX. We require U.min > T.max for safety.
 *
 * If group matches are fully played, every rank is trivially locked.
 *
 * @param standings rank-assigned standings for the group (output of
 *                  `sortStandings`)
 * @param matches   ALL matches in the tournament; the function filters
 *                  to the right group internally
 * @param groupId   the group whose ranks we're testing
 */
export function computeLockedRanks(
  standings: StandingRow[],
  matches: Match[],
  groupId: string,
): Set<number> {
  const out = new Set<number>();
  if (standings.length === 0) return out;

  // Remaining matches per team in this group. A team's max final points
  // is current + 3 * remaining; their min is current (lose them all).
  const remainingByTeam = new Map<string, number>();
  for (const m of matches) {
    if (m.phase !== 'group') continue;
    if (m.groupId !== groupId) continue;
    if (m.status === 'finished' || m.status === 'abandoned') continue;
    const teams = [m.teamA.teamId, m.teamB.teamId];
    for (const t of teams) {
      remainingByTeam.set(t, (remainingByTeam.get(t) ?? 0) + 1);
    }
  }

  // If nothing is left to play, all ranks are locked.
  let anyRemaining = false;
  for (const r of remainingByTeam.values()) if (r > 0) anyRemaining = true;
  if (!anyRemaining) {
    standings.forEach((row) => out.add(row.rank));
    return out;
  }

  function minMax(row: StandingRow): { min: number; max: number } {
    const remaining = remainingByTeam.get(row.teamId) ?? 0;
    return { min: row.points, max: row.points + 3 * remaining };
  }

  for (const T of standings) {
    const tBounds = minMax(T);
    let locked = true;
    for (const U of standings) {
      if (U.teamId === T.teamId) continue;
      const uBounds = minMax(U);
      if (U.rank > T.rank) {
        // U currently below T — could overtake if their max ≥ T's min.
        if (uBounds.max >= tBounds.min) {
          locked = false;
          break;
        }
      } else if (U.rank < T.rank) {
        // U currently above T — could fall below if their min ≤ T's max.
        if (uBounds.min <= tBounds.max) {
          locked = false;
          break;
        }
      }
    }
    if (locked) out.add(T.rank);
  }
  return out;
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
