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
 * Mirrors the public KnockoutPage SCHEDULE template. Every match cell
 * shown on /nokaut gets a Firestore doc — unresolved teams use the
 * same placeholder label the bracket page renders ("1A", "pob. ČF1",
 * "por. PF1", etc.). propagateBracketWinner overwrites those placeholders
 * when upstream matches finish.
 *
 * If you rewire pairings on KnockoutPage, mirror the change here.
 */
type SourceRef =
  | { type: 'standing'; pos: number; letter: string }
  | { type: 'winner'; sourceSlot: string }
  | { type: 'loser'; sourceSlot: string };

interface TemplateCell {
  slot: 'QF1' | 'QF2' | 'QF3' | 'QF4' | 'SF1' | 'SF2' | 'TP' | 'FINAL';
  round: KnockoutRound;
  time: string;
  /** Index into `tournament.config.fields`. */
  fieldIndex: number;
  teamA: SourceRef;
  teamB: SourceRef;
}

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
    teamA: { type: 'winner', sourceSlot: 'QF1' },
    teamB: { type: 'winner', sourceSlot: 'QF4' },
  },
  {
    slot: 'SF2',
    round: 'sf',
    time: '15:00',
    fieldIndex: 0,
    teamA: { type: 'winner', sourceSlot: 'QF2' },
    teamB: { type: 'winner', sourceSlot: 'QF3' },
  },
  {
    slot: 'TP',
    round: 'thirdPlace',
    time: '17:00',
    fieldIndex: 0,
    teamA: { type: 'loser', sourceSlot: 'SF1' },
    teamB: { type: 'loser', sourceSlot: 'SF2' },
  },
  {
    slot: 'FINAL',
    round: 'final',
    time: '19:00',
    fieldIndex: 0,
    teamA: { type: 'winner', sourceSlot: 'SF1' },
    teamB: { type: 'winner', sourceSlot: 'SF2' },
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

function placeholderStanding(pos: number, letter: string): TeamSnapshot {
  return { teamId: `__placeholder__${pos}${letter}`, name: `${pos}${letter}` };
}

function placeholderDerived(role: 'winner' | 'loser', sourceSlot: string): TeamSnapshot {
  const verb = role === 'winner' ? 'pob.' : 'por.';
  return {
    teamId: `__placeholder__${role}_${sourceSlot}`,
    name: `${verb} ${labelForSlot(sourceSlot)}`,
  };
}

export interface GenerateBracketResult {
  created: string[];
  skipped: { slot: string; reason: string }[];
}

/**
 * Create every missing knockout match (QF1–QF4, SF1, SF2, TP, FINAL).
 *
 *  - QFs: teams resolve from live group standings (with manualOrder).
 *    Falls back to "1A" / "4B" placeholders if standings can't resolve.
 *  - SF / TP / FINAL: if the source QF/SF is finished, the winner /
 *    loser snapshot is used directly. Otherwise the placeholder label
 *    ("pob. ČF1", "por. PF1") is written and propagateBracketWinner
 *    overwrites it when the source match finishes.
 *
 * Skips slots that already have a match doc.
 * Day-2 date = `tournament.startDate + 1 day`; times + fields per TEMPLATE.
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
  const matchBySlot = new Map<string, Match>();
  for (const m of matches) {
    if (m.phase === 'knockout' && m.bracketSlot) matchBySlot.set(m.bracketSlot, m);
  }

  function resolve(ref: SourceRef): TeamSnapshot {
    if (ref.type === 'standing') {
      const row = standingsByLetter
        .get(ref.letter)
        ?.find((r) => r.rank === ref.pos);
      const real = row ? teamById.get(row.teamId) : undefined;
      return real ? makeSnap(real) : placeholderStanding(ref.pos, ref.letter);
    }
    // winner / loser of a previous slot
    const source = matchBySlot.get(ref.sourceSlot);
    if (source && source.status === 'finished') {
      const aWon = source.shootoutScore
        ? source.shootoutScore.a > source.shootoutScore.b
        : source.score.a > source.score.b;
      const winnerSnap = aWon ? source.teamA : source.teamB;
      const loserSnap = aWon ? source.teamB : source.teamA;
      return ref.type === 'winner' ? winnerSnap : loserSnap;
    }
    return placeholderDerived(ref.type, ref.sourceSlot);
  }

  const created: string[] = [];
  const skipped: { slot: string; reason: string }[] = [];

  for (const cell of TEMPLATE) {
    if (matchBySlot.has(cell.slot)) {
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
 * Delete every scheduled knockout match that isn't a quarterfinal.
 * Used to wipe SF / TP / FINAL when they need to be regenerated from
 * scratch (e.g. QF pairings changed). Won't touch live / finished docs.
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
