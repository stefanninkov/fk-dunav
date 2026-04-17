import {
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { matchDoc, matchesCol } from '@/lib/firestore/refs';
import type {
  KnockoutRound,
  Match,
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
