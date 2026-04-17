import {
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
  batch.set(ref, {
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
  } as unknown as Match);
  await batch.commit();
  return ref.id;
}

export async function updateMatchSchedule(
  tournamentId: string,
  matchId: string,
  patch: { scheduledStart?: Date; field?: string; groupId?: string },
): Promise<void> {
  const body: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.scheduledStart) body.scheduledStart = Timestamp.fromDate(patch.scheduledStart);
  if (patch.field !== undefined) body.field = patch.field;
  if (patch.groupId !== undefined) body.groupId = patch.groupId;
  await updateDoc(matchDoc(tournamentId, matchId), body);
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
  const payload: Partial<MatchEvent> = {
    ...partial,
    matchId,
    clientEventId,
    loggedAt: Timestamp.now(),
    serverTimestamp: Timestamp.now(),
    deleted: false,
  };
  batch.set(doc(ref.firestore, ref.path), payload as never);
}
