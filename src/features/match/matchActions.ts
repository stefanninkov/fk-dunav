import {
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import {
  matchDoc,
  matchEventDoc,
  matchesCol,
} from '@/lib/firestore/refs';
import type {
  KnockoutRound,
  Match,
  MatchEvent,
  MatchPhase,
  TeamSnapshot,
} from '@/lib/firestore/types';
import { stripUndefined, stripUndefinedDeep } from '@/lib/utils/stripUndefined';

export interface CreateMatchInput {
  phase: MatchPhase;
  groupId?: string;
  knockoutRound?: KnockoutRound;
  bracketSlot?: string;
  field: string;
  scheduledStart: Date;
  teamA: TeamSnapshot;
  teamB: TeamSnapshot;
}

export async function createMatch(
  tournamentId: string,
  input: CreateMatchInput,
): Promise<string> {
  const ref = doc(matchesCol(tournamentId));
  const batch = writeBatch(db);
  // Deep strip so nested team-snapshot undefineds (e.g. shortName, logoUrl)
  // don't sneak through; Firestore rejects undefined at any depth.
  batch.set(
    ref,
    stripUndefinedDeep({
      tournamentId,
      phase: input.phase,
      groupId: input.groupId,
      knockoutRound: input.knockoutRound,
      bracketSlot: input.bracketSlot,
      field: input.field,
      scheduledStart: Timestamp.fromDate(input.scheduledStart),
      teamA: input.teamA,
      teamB: input.teamB,
      score: { a: 0, b: 0 },
      status: 'scheduled',
      clock: {
        state: 'idle',
        currentHalf: 1,
        halfStartedAt: null,
        accumulatedSeconds: 0,
        displayMinute: 0,
      },
      lockedForEdit: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }) as unknown as Match,
  );
  await batch.commit();
  return ref.id;
}

export async function updateMatchSchedule(
  tournamentId: string,
  matchId: string,
  patch: {
    scheduledStart?: Date;
    field?: string;
    groupId?: string;
    teamA?: TeamSnapshot;
    teamB?: TeamSnapshot;
  },
): Promise<void> {
  const body: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.scheduledStart) body.scheduledStart = Timestamp.fromDate(patch.scheduledStart);
  if (patch.field !== undefined) body.field = patch.field;
  if (patch.groupId !== undefined) body.groupId = patch.groupId;
  if (patch.teamA !== undefined) body.teamA = stripUndefinedDeep(patch.teamA);
  if (patch.teamB !== undefined) body.teamB = stripUndefinedDeep(patch.teamB);
  await updateDoc(matchDoc(tournamentId, matchId), body);
}

/**
 * Delete a match doc outright. The admin is responsible for confirming
 * before calling — live or finished matches usually shouldn't be deleted
 * because they hold the event log and the standings recompute reads them.
 */
export async function deleteMatch(
  tournamentId: string,
  matchId: string,
): Promise<void> {
  await deleteDoc(matchDoc(tournamentId, matchId));
}

// ---------------------------------------------------------------------------
// Clock + lifecycle

export async function startMatch(
  tournamentId: string,
  matchId: string,
  uid: string,
): Promise<void> {
  const ref = matchDoc(tournamentId, matchId);
  const batch = writeBatch(db);
  batch.update(ref, {
    status: 'live',
    actualStart: serverTimestamp(),
    'clock.state': 'running',
    'clock.currentHalf': 1,
    'clock.halfStartedAt': serverTimestamp(),
    'clock.accumulatedSeconds': 0,
    'clock.displayMinute': 0,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  await appendEventBatch(batch, tournamentId, matchId, {
    type: 'matchStart',
    minute: 0,
    createdBy: uid,
  });
  await batch.commit();
}

export async function pauseMatch(
  tournamentId: string,
  matchId: string,
  uid: string,
  displayMinute: number,
): Promise<void> {
  await updateDoc(matchDoc(tournamentId, matchId), {
    'clock.state': 'paused',
    'clock.halfStartedAt': null,
    'clock.displayMinute': displayMinute,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function resumeMatch(
  tournamentId: string,
  matchId: string,
  uid: string,
): Promise<void> {
  await updateDoc(matchDoc(tournamentId, matchId), {
    'clock.state': 'running',
    'clock.halfStartedAt': serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function endHalf(
  tournamentId: string,
  matchId: string,
  uid: string,
  displayMinute: number,
): Promise<void> {
  const ref = matchDoc(tournamentId, matchId);
  const batch = writeBatch(db);
  batch.update(ref, {
    'clock.state': 'halftime',
    'clock.halfStartedAt': null,
    'clock.displayMinute': displayMinute,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  await appendEventBatch(batch, tournamentId, matchId, {
    type: 'halfEnd',
    minute: displayMinute,
    createdBy: uid,
  });
  await batch.commit();
}

export async function startSecondHalf(
  tournamentId: string,
  matchId: string,
  uid: string,
  halfDurationSeconds: number,
): Promise<void> {
  const ref = matchDoc(tournamentId, matchId);
  const batch = writeBatch(db);
  batch.update(ref, {
    'clock.state': 'running',
    'clock.currentHalf': 2,
    'clock.halfStartedAt': serverTimestamp(),
    'clock.accumulatedSeconds': halfDurationSeconds,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  await appendEventBatch(batch, tournamentId, matchId, {
    type: 'halfStart',
    minute: Math.floor(halfDurationSeconds / 60),
    createdBy: uid,
  });
  await batch.commit();
}

export async function endMatch(
  tournamentId: string,
  matchId: string,
  uid: string,
  displayMinute: number,
  shootoutScore?: { a: number; b: number },
): Promise<void> {
  const ref = matchDoc(tournamentId, matchId);
  const batch = writeBatch(db);
  const update: Record<string, unknown> = {
    status: 'finished',
    'clock.state': 'ended',
    'clock.halfStartedAt': null,
    'clock.displayMinute': displayMinute,
    actualEnd: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  if (shootoutScore) update.shootoutScore = shootoutScore;
  batch.update(ref, update);
  await appendEventBatch(batch, tournamentId, matchId, {
    type: 'matchEnd',
    minute: displayMinute,
    createdBy: uid,
  });
  await batch.commit();
}

/**
 * Set the penalty-shootout score directly — the simple alternative to
 * the kick-by-kick ShootoutModal. If the match is still live, also
 * closes it out (status='finished', clock ended) so the winner
 * propagates to the next bracket slot.
 */
export async function setShootoutScore(
  tournamentId: string,
  matchId: string,
  uid: string,
  shootoutScore: { a: number; b: number },
  finishMatch: boolean,
): Promise<void> {
  const ref = matchDoc(tournamentId, matchId);
  const body: Record<string, unknown> = {
    shootoutScore,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
  if (finishMatch) {
    body.status = 'finished';
    body['clock.state'] = 'ended';
    body['clock.halfStartedAt'] = null;
    body.actualEnd = serverTimestamp();
  }
  await updateDoc(ref, body);
}

/**
 * Override the cached score directly. Used when the events log is wrong
 * (reporter forgot to log goals, etc.) or to fix a stuck 0:0 final.
 * Sets `manualScore: true` so the `recomputeMatchScore` Cloud Function
 * leaves the doc alone going forward.
 */
export async function setMatchScore(
  tournamentId: string,
  matchId: string,
  uid: string,
  score: { a: number; b: number },
): Promise<void> {
  await updateDoc(matchDoc(tournamentId, matchId), {
    score,
    manualScore: true,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

/**
 * Forfeit ("predaja"): one side didn't show up so the present side
 * walks away with a 3:0 official scoreline. Stamps a final score and
 * closes out the match — NO matchEnd event written, because the
 * `recomputeMatchScore` Cloud Function would otherwise see zero goal
 * events and clobber the score back to 0:0.
 */
export async function forfeitMatch(
  tournamentId: string,
  matchId: string,
  uid: string,
  winnerSide: 'a' | 'b',
): Promise<void> {
  const ref = matchDoc(tournamentId, matchId);
  const score = winnerSide === 'a' ? { a: 3, b: 0 } : { a: 0, b: 3 };
  await updateDoc(ref, {
    status: 'finished',
    score,
    forfeit: true,
    forfeitWinner: winnerSide,
    'clock.state': 'ended',
    'clock.halfStartedAt': null,
    'clock.displayMinute': 0,
    actualEnd: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

export async function abandonMatch(
  tournamentId: string,
  matchId: string,
  uid: string,
  minute: number,
): Promise<void> {
  const ref = matchDoc(tournamentId, matchId);
  const batch = writeBatch(db);
  batch.update(ref, {
    status: 'abandoned',
    'clock.state': 'ended',
    'clock.halfStartedAt': null,
    'clock.displayMinute': minute,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  await appendEventBatch(batch, tournamentId, matchId, {
    type: 'abandoned',
    minute,
    createdBy: uid,
  });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Events (goals / cards)

export interface LogGoalInput {
  team: 'a' | 'b';
  minute: number;
  playerId?: string;
  playerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  ownGoal?: boolean;
}

export async function logGoal(
  tournamentId: string,
  matchId: string,
  uid: string,
  input: LogGoalInput,
): Promise<void> {
  const ref = matchDoc(tournamentId, matchId);
  const batch = writeBatch(db);
  // Eagerly bump the cached score; a Cloud Function will later recompute
  // from the event log (Phase 4 back-end work).
  batch.update(ref, {
    [`score.${input.team}`]: increment(1),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  await appendEventBatch(batch, tournamentId, matchId, {
    type: 'goal',
    minute: input.minute,
    team: input.team,
    playerId: input.playerId,
    playerName: input.playerName,
    assistPlayerId: input.assistPlayerId,
    assistPlayerName: input.assistPlayerName,
    ownGoal: input.ownGoal,
    createdBy: uid,
  });
  await batch.commit();
}

export interface LogCardInput {
  team: 'a' | 'b';
  type: 'yellowCard' | 'redCard';
  minute: number;
  playerId?: string;
  playerName?: string;
}

export async function logCard(
  tournamentId: string,
  matchId: string,
  uid: string,
  input: LogCardInput,
): Promise<void> {
  const batch = writeBatch(db);
  await appendEventBatch(batch, tournamentId, matchId, {
    type: input.type,
    minute: input.minute,
    team: input.team,
    playerId: input.playerId,
    playerName: input.playerName,
    createdBy: uid,
  });
  await batch.commit();
}

/**
 * Soft-delete an event so the public timeline + score recompute skip it.
 * Reporters can delete their OWN events (rule-enforced); admins can
 * delete anyone's. If the event was a goal, decrement the cached score.
 */
export async function softDeleteEvent(
  tournamentId: string,
  matchId: string,
  event: MatchEvent,
  uid: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(matchEventDoc(tournamentId, matchId, event.id), {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: uid,
  });
  if (event.type === 'goal' && (event.team === 'a' || event.team === 'b')) {
    batch.update(matchDoc(tournamentId, matchId), {
      [`score.${event.team}`]: increment(-1),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  }
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Internal

async function appendEventBatch(
  batch: ReturnType<typeof writeBatch>,
  tournamentId: string,
  matchId: string,
  partial: Partial<MatchEvent> & {
    type: MatchEvent['type'];
    minute: number;
    createdBy: string;
  },
): Promise<void> {
  const clientEventId = crypto.randomUUID();
  const ref = matchEventDoc(tournamentId, matchId, clientEventId);
  const payload = stripUndefined({
    ...partial,
    matchId,
    clientEventId,
    loggedAt: Timestamp.now(),
    serverTimestamp: Timestamp.now(),
    deleted: false,
  });
  batch.set(doc(ref.firestore, ref.path), payload as never);
}
