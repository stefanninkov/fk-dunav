import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import {
  lotteryCol,
  lotteryDoc,
  lotterySessionDoc,
} from '@/lib/firestore/refs';
import type { LotteryPrize, LotterySession } from '@/lib/firestore/types';
import { stripUndefined } from '@/lib/utils/stripUndefined';

// ---------------------------------------------------------------------------
// Prizes — the items being drawn. Created empty (no winner);
// `drawLotteryWinner` mutates them to record the winning slip number.

export async function createLotteryPrize(
  tournamentId: string,
  input: { label: string; order: number },
  createdBy: string,
): Promise<string> {
  const ref = doc(lotteryCol(tournamentId));
  await setDoc(ref, {
    label: input.label.trim(),
    order: input.order,
    createdAt: serverTimestamp(),
    createdBy,
  } as unknown as LotteryPrize);
  return ref.id;
}

export async function updateLotteryPrize(
  tournamentId: string,
  prizeId: string,
  patch: { label?: string; order?: number },
): Promise<void> {
  await updateDoc(lotteryDoc(tournamentId, prizeId), stripUndefined(patch));
}

export async function deleteLotteryPrize(
  tournamentId: string,
  prizeId: string,
): Promise<void> {
  await deleteDoc(lotteryDoc(tournamentId, prizeId));
}

// ---------------------------------------------------------------------------
// Draw — picks a random integer in 1..participantCount, excluding any
// number already recorded as a winner on another prize. Session's
// participantCount is the single source of truth for the pool.

export async function drawLotteryWinner(
  tournamentId: string,
  prizeId: string,
): Promise<{ number: number } | null> {
  const [sessionSnap, prizesSnap] = await Promise.all([
    getDoc(lotterySessionDoc(tournamentId)),
    getDocs(lotteryCol(tournamentId)),
  ]);

  const count = sessionSnap.data()?.participantCount ?? 0;
  if (count <= 0) return null;

  const taken = new Set<number>();
  for (const d of prizesSnap.docs) {
    const name = d.data().winnerName;
    if (!name) continue;
    const n = Number(name);
    if (Number.isInteger(n)) taken.add(n);
  }

  if (taken.size >= count) return null; // pool exhausted

  // Rejection sample — cheap for small exhaustion ratios; worst case
  // (one slot left) we loop a few times. Bounded at 2 * count iterations.
  let pick: number | null = null;
  for (let i = 0; i < count * 2; i++) {
    const candidate = Math.floor(Math.random() * count) + 1;
    if (!taken.has(candidate)) {
      pick = candidate;
      break;
    }
  }
  if (pick === null) return null;

  await updateDoc(lotteryDoc(tournamentId, prizeId), {
    winnerName: String(pick),
    drawnAt: serverTimestamp(),
  });
  return { number: pick };
}

export async function undrawLotteryWinner(
  tournamentId: string,
  prizeId: string,
): Promise<void> {
  await updateDoc(lotteryDoc(tournamentId, prizeId), {
    winnerName: deleteField(),
    winnerParticipantId: deleteField(), // clean up any legacy field
    drawnAt: deleteField(),
  });
}

// ---------------------------------------------------------------------------
// Session — single "current" doc holding the slip count. Public /lutrija
// reads it for the pool size.

export async function setLotteryParticipantCount(
  tournamentId: string,
  count: number,
  updatedBy: string,
): Promise<void> {
  await setDoc(
    lotterySessionDoc(tournamentId),
    {
      participantCount: Math.max(0, Math.floor(count)),
      updatedAt: serverTimestamp(),
      updatedBy,
    } as unknown as LotterySession,
    { merge: true },
  );
}
