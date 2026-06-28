import type {
  Group,
  KnockoutRound,
  Match,
  Team,
  TeamSnapshot,
  TiebreakerKey,
  Tournament,
} from '@/lib/firestore/types';
import { createMatch, deleteMatch } from '@/features/match/matchActions';
import { computeStandings, sortStandings } from '@/lib/utils/standings';

/**
 * Mirrors the public KnockoutPage SCHEDULE template. Any time you rewire
 * the bracket there, mirror the change here so the schedule generator
 * keeps producing the same pairings.
 *
 * NOTE: only QFs are listed. SF / TP / FINAL get created later (after
 * upstream matches finish) — generating them up-front with placeholder
 * teams was confusing because the slots showed random pairings.
 */
interface TemplateCell {
  slot: 'QF1' | 'QF2' | 'QF3' | 'QF4';
  round: KnockoutRound;
  time: string;
  /** Index into `tournament.config.fields`. */
  fieldIndex: number;
  teamA: { pos: number; letter: string };
  teamB: { pos: number; letter: string };
}

const TEMPLATE: TemplateCell[] = [
  {
    slot: 'QF1',
    round: 'qf',
    time: '11:00',
    fieldIndex: 0,
    teamA: { pos: 1, letter: 'A' },
    teamB: { pos: 4, letter: 'B' },
  },
  {
    slot: 'QF2',
    round: 'qf',
    time: '11:00',
    fieldIndex: 1,
    teamA: { pos: 1, letter: 'B' },
    teamB: { pos: 4, letter: 'A' },
  },
  {
    slot: 'QF3',
    round: 'qf',
    time: '12:00',
    fieldIndex: 0,
    teamA: { pos: 2, letter: 'A' },
    teamB: { pos: 3, letter: 'B' },
  },
  {
    slot: 'QF4',
    round: 'qf',
    time: '12:00',
    fieldIndex: 1,
    teamA: { pos: 2, letter: 'B' },
    teamB: { pos: 3, letter: 'A' },
  },
];

function letterForGroup(g: Group): string {
  return String.fromCharCode('A'.charCodeAt(0) + Math.max(0, g.order));
}

function makeSnap(t: Team): TeamSnapshot {
  const out: TeamSnapshot = { teamId: t.id, name: t.name };
  if (t.shortName) out.shortName = t.shortName;
  if (t.logoUrl) out.logoUrl = t.logoUrl;
  if (t.groupId) out.groupId = t.groupId;
  return out;
}

/**
 * Placeholder snapshot used when the standings can't be resolved yet
 * (group letter missing, not enough teams, etc.). The name mirrors the
 * public /nokaut label ("1A", "4B") so the row reads the same way.
 */
function placeholderSnap(pos: number, letter: string): TeamSnapshot {
  return { teamId: `__placeholder__${pos}${letter}`, name: `${pos}${letter}` };
}

export interface GenerateBracketResult {
  created: string[];
  skipped: { slot: string; reason: string }[];
}

/**
 * Create every missing QF match for the tournament. Skips slots that
 * already have a match doc. teamA/teamB are resolved from the live
 * group standings (with `Group.manualOrder` applied); if a position
 * can't be resolved, a placeholder snapshot with the public /nokaut
 * label ("1A", "4B") is written instead.
 *
 * Day-2 date comes from `tournament.startDate + 1 day`. Times + field
 * positions come from the TEMPLATE constant above.
 */
export async function generateBracketMatches(params: {
  tournament: Tournament;
  groups: Group[];
  teams: Team[];
  matches: Match[];
  tiebreakerOrder: TiebreakerKey[];
}): Promise<GenerateBracketResult> {
  const { tournament, groups, teams, matches, tiebreakerOrder } = params;

  const standingsByLetter = new Map<
    string,
    ReturnType<typeof sortStandings>
  >();
  for (const g of groups) {
    const groupTeams = teams.filter(
      (t) => !t.deletedAt && t.groupId === g.id,
    );
    if (groupTeams.length === 0) continue;
    const raw = computeStandings({ teams: groupTeams, matches });
    const sorted = sortStandings({
      standings: raw,
      matches,
      order: tiebreakerOrder,
      manualOrder: g.manualOrder,
    });
    standingsByLetter.set(letterForGroup(g), sorted);
  }

  const day2 = new Date(tournament.startDate.toDate());
  day2.setDate(day2.getDate() + 1);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const fields = tournament.config.fields;

  function resolve(ref: { pos: number; letter: string }): TeamSnapshot {
    const row = standingsByLetter.get(ref.letter)?.find((r) => r.rank === ref.pos);
    const real = row ? teamById.get(row.teamId) : undefined;
    return real ? makeSnap(real) : placeholderSnap(ref.pos, ref.letter);
  }

  const created: string[] = [];
  const skipped: { slot: string; reason: string }[] = [];

  for (const cell of TEMPLATE) {
    if (
      matches.some(
        (m) => m.phase === 'knockout' && m.bracketSlot === cell.slot,
      )
    ) {
      skipped.push({ slot: cell.slot, reason: 'već postoji' });
      continue;
    }

    const teamA = resolve(cell.teamA);
    const teamB = resolve(cell.teamB);

    const [hh, mm] = cell.time.split(':').map(Number);
    const scheduledStart = new Date(day2);
    scheduledStart.setHours(hh, mm, 0, 0);

    await createMatch(tournament.id, {
      phase: 'knockout',
      knockoutRound: cell.round,
      bracketSlot: cell.slot,
      field: fields[cell.fieldIndex] ?? fields[0] ?? 'Teren 1',
      scheduledStart,
      teamA,
      teamB,
    });
    created.push(cell.slot);
  }

  return { created, skipped };
}

/**
 * Delete every knockout match doc that isn't a quarterfinal AND hasn't
 * started yet. Used to clean up SF / TP / FINAL slots that were
 * generated too early — once QFs finish the admin re-runs
 * `generateBracketMatches` (or a future SF generator) to recreate them
 * with real teams.
 */
export async function deleteUnfinishedKnockoutDownstream(
  tournamentId: string,
  matches: Match[],
): Promise<string[]> {
  const targets = matches.filter(
    (m) =>
      m.phase === 'knockout' &&
      m.status === 'scheduled' &&
      m.knockoutRound !== 'qf',
  );
  for (const m of targets) {
    await deleteMatch(tournamentId, m.id);
  }
  return targets.map((m) => m.bracketSlot ?? m.id);
}
