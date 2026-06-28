import type {
  Group,
  KnockoutRound,
  Match,
  Team,
  TeamSnapshot,
  TiebreakerKey,
  Tournament,
} from '@/lib/firestore/types';
import { createMatch } from '@/features/match/matchActions';
import { computeStandings, sortStandings } from '@/lib/utils/standings';

/**
 * Mirrors the public KnockoutPage SCHEDULE template. Any time you rewire
 * the bracket there, mirror the change here so the schedule generator
 * keeps producing the same pairings.
 */
interface TemplateCell {
  slot: 'QF1' | 'QF2' | 'QF3' | 'QF4' | 'SF1' | 'SF2' | 'TP' | 'FINAL';
  round: KnockoutRound;
  time: string;
  /** Index into `tournament.config.fields`. */
  fieldIndex: number;
  teamA: SourceRef;
  teamB: SourceRef;
}

type SourceRef =
  | { type: 'standing'; pos: number; letter: string }
  | { type: 'derived' };

const TEMPLATE: TemplateCell[] = [
  {
    slot: 'QF1',
    round: 'qf',
    time: '11:00',
    fieldIndex: 0,
    teamA: { type: 'standing', pos: 1, letter: 'A' },
    teamB: { type: 'standing', pos: 4, letter: 'B' },
  },
  {
    slot: 'QF2',
    round: 'qf',
    time: '11:00',
    fieldIndex: 1,
    teamA: { type: 'standing', pos: 1, letter: 'B' },
    teamB: { type: 'standing', pos: 4, letter: 'A' },
  },
  {
    slot: 'QF3',
    round: 'qf',
    time: '12:00',
    fieldIndex: 0,
    teamA: { type: 'standing', pos: 2, letter: 'A' },
    teamB: { type: 'standing', pos: 3, letter: 'B' },
  },
  {
    slot: 'QF4',
    round: 'qf',
    time: '12:00',
    fieldIndex: 1,
    teamA: { type: 'standing', pos: 2, letter: 'B' },
    teamB: { type: 'standing', pos: 3, letter: 'A' },
  },
  {
    slot: 'SF1',
    round: 'sf',
    time: '14:00',
    fieldIndex: 0,
    teamA: { type: 'derived' },
    teamB: { type: 'derived' },
  },
  {
    slot: 'SF2',
    round: 'sf',
    time: '15:00',
    fieldIndex: 0,
    teamA: { type: 'derived' },
    teamB: { type: 'derived' },
  },
  {
    slot: 'TP',
    round: 'thirdPlace',
    time: '17:00',
    fieldIndex: 0,
    teamA: { type: 'derived' },
    teamB: { type: 'derived' },
  },
  {
    slot: 'FINAL',
    round: 'final',
    time: '19:00',
    fieldIndex: 0,
    teamA: { type: 'derived' },
    teamB: { type: 'derived' },
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

export interface GenerateBracketResult {
  created: string[];
  skipped: { slot: string; reason: string }[];
}

/**
 * Create every missing knockout match (QF1-4, SF1-2, TP, FINAL) for the
 * tournament in one shot. Skips slots that already have a match doc.
 *
 *  - QFs resolve teamA/teamB from the live group standings (with
 *    `Group.manualOrder` applied). If a position can't be resolved
 *    (group letter missing, not enough teams) the QF is skipped.
 *  - SF / TP / FINAL get placeholder teams (the first two teams of the
 *    tournament). `propagateBracketWinner` overwrites teamA/teamB on
 *    these slots when their source matches finish, so the placeholders
 *    are temporary until the upstream QFs/SFs are decided.
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
  const placeholderA = teams[0];
  const placeholderB = teams[1] ?? teams[0];

  function resolve(ref: SourceRef): Team | undefined {
    if (ref.type === 'standing') {
      const row = standingsByLetter.get(ref.letter)?.find((r) => r.rank === ref.pos);
      return row ? teamById.get(row.teamId) : undefined;
    }
    return placeholderA;
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
    let teamB =
      cell.teamB.type === 'derived' ? placeholderB : resolve(cell.teamB);

    if (!teamA || !teamB) {
      skipped.push({
        slot: cell.slot,
        reason: 'timovi nisu rešeni',
      });
      continue;
    }
    if (teamA.id === teamB.id) {
      // Placeholder collision (e.g. only one team in the tournament).
      // Force teamB to the next available team.
      teamB = teams.find((t) => t.id !== teamA!.id) ?? teamB;
    }

    const [hh, mm] = cell.time.split(':').map(Number);
    const scheduledStart = new Date(day2);
    scheduledStart.setHours(hh, mm, 0, 0);

    await createMatch(tournament.id, {
      phase: 'knockout',
      knockoutRound: cell.round,
      bracketSlot: cell.slot,
      field: fields[cell.fieldIndex] ?? fields[0] ?? 'Teren 1',
      scheduledStart,
      teamA: makeSnap(teamA),
      teamB: makeSnap(teamB),
    });
    created.push(cell.slot);
  }

  return { created, skipped };
}
