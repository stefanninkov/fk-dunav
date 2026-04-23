import {
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { fanPollDoc } from '@/lib/firestore/refs';
import type {
  FanPoll,
  FanPollCandidate,
  FanPollId,
} from '@/lib/firestore/types';
import { stripUndefined } from '@/lib/utils/stripUndefined';

export async function upsertPoll(
  tournamentId: string,
  pollId: FanPollId,
  patch: Partial<Omit<FanPoll, 'id'>>,
): Promise<void> {
  await setDoc(
    fanPollDoc(tournamentId, pollId),
    stripUndefined({ ...patch }) as unknown as FanPoll,
    { merge: true },
  );
}

export async function setPollStatus(
  tournamentId: string,
  pollId: FanPollId,
  status: 'open' | 'closed',
  closesAt?: Date,
): Promise<void> {
  const body: Record<string, unknown> = { status };
  if (status === 'open') body.openedAt = serverTimestamp();
  if (closesAt) body.closesAt = Timestamp.fromDate(closesAt);
  await setDoc(fanPollDoc(tournamentId, pollId), body, { merge: true });
}

export async function addCandidate(
  tournamentId: string,
  pollId: FanPollId,
  candidate: Omit<FanPollCandidate, 'voteCount'>,
  existing: FanPollCandidate[],
): Promise<void> {
  const candidates = [
    ...existing,
    { ...stripUndefined(candidate), voteCount: 0 } as FanPollCandidate,
  ];
  await updateDoc(fanPollDoc(tournamentId, pollId), { candidates });
}

export async function removeCandidate(
  tournamentId: string,
  pollId: FanPollId,
  candidateId: string,
  existing: FanPollCandidate[],
): Promise<void> {
  const candidates = existing.filter((c) => c.id !== candidateId);
  await updateDoc(fanPollDoc(tournamentId, pollId), { candidates });
}

export async function deletePoll(
  tournamentId: string,
  pollId: FanPollId,
): Promise<void> {
  await deleteDoc(fanPollDoc(tournamentId, pollId));
}

/**
 * Record a single vote from an anonymous visitor. We use a subcollection
 * of /fanVotes/{pollId}/votes/{deviceId} with doc id = deviceId so the
 * second vote from the same device hits the "create once" rule and fails.
 * The rule lives in firestore.rules — this helper just issues the write.
 */
export async function recordVote(
  tournamentId: string,
  pollId: FanPollId,
  deviceId: string,
  candidateId: string,
  existing: FanPollCandidate[],
): Promise<void> {
  const voteRef = doc(
    db,
    'tournaments',
    tournamentId,
    'fanVotes',
    pollId,
    'votes',
    deviceId,
  );
  const batch = writeBatch(db);
  batch.set(voteRef, {
    deviceId,
    candidateId,
    createdAt: serverTimestamp(),
  });
  const updatedCandidates = existing.map((c) =>
    c.id === candidateId ? { ...c, voteCount: c.voteCount + 1 } : c,
  );
  batch.update(fanPollDoc(tournamentId, pollId), { candidates: updatedCandidates });
  await batch.commit();
}

// Kept for future use (once per-candidate counter moves into a subcollection).
export const _increment = increment;
