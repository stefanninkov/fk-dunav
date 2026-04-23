import {
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import {
  lotteryCol,
  lotteryDoc,
  lotteryParticipantDoc,
  lotteryParticipantsCol,
  lotterySessionDoc,
} from '@/lib/firestore/refs';
import type {
  LotteryParticipant,
  LotteryPrize,
  LotterySession,
} from '@/lib/firestore/types';

// ---------------------------------------------------------------------------
// Participants — the raffle pool. Admin enters names upfront; the live draw
// picks random unassigned participants and writes them onto prize docs.

export async function createLotteryParticipant(
  tournamentId: string,
  input: { name: string; note?: string },
  createdBy: string,
): Promise<string> {
  const ref = doc(lotteryParticipantsCol(tournamentId));
  const note = input.note?.trim();
  await setDoc(ref, {
    name: input.name.trim(),
    ...(note ? { note } : {}),
    createdAt: serverTimestamp(),
    createdBy,
  } as unknown as LotteryParticipant);
  return ref.id;
}

export async function deleteLotteryParticipant(
  tournamentId: string,
  participantId: string,
): Promise<void> {
  await deleteDoc(lotteryParticipantDoc(tournamentId, participantId));
}

// ---------------------------------------------------------------------------
// Prizes — the items being drawn. Created empty (no winner); `drawLotteryWinner`
// mutates them to record the winner during the live event.

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
  await updateDoc(lotteryDoc(tournamentId, prizeId), patch);
}

export async function deleteLotteryPrize(
  tournamentId: string,
  prizeId: string,
): Promise<void> {
  await deleteDoc(lotteryDoc(tournamentId, prizeId));
}

// ---------------------------------------------------------------------------
// Draw / undraw. The draw reads all participants and all prizes, filters out
// anyone already assigned as a winner, picks a uniform random survivor, and
// writes the winner onto the prize. Not inside a Firestore transaction because
// we need to list two whole collections — a double-assignment race is possible
// only if two admins click simultaneously, and `undrawLotteryWinner` is always
// available as an escape hatch.

export async function drawLotteryWinner(
  tournamentId: string,
  prizeId: string,
): Promise<{ participantId: string; name: string } | null> {
  const [participantsSnap, prizesSnap] = await Promise.all([
    getDocs(lotteryParticipantsCol(tournamentId)),
    getDocs(lotteryCol(tournamentId)),
  ]);

  const taken = new Set<string>();
  for (const d of prizesSnap.docs) {
    const wid = d.data().winnerParticipantId;
    if (wid) taken.add(wid);
  }

  const remaining = participantsSnap.docs.filter((d) => !taken.has(d.id));
  if (remaining.length === 0) return null;

  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  const picked = pick.data();
  await updateDoc(lotteryDoc(tournamentId, prizeId), {
    winnerParticipantId: pick.id,
    winnerName: picked.name,
    drawnAt: serverTimestamp(),
  });
  return { participantId: pick.id, name: picked.name };
}

export async function undrawLotteryWinner(
  tournamentId: string,
  prizeId: string,
): Promise<void> {
  await updateDoc(lotteryDoc(tournamentId, prizeId), {
    winnerParticipantId: deleteField(),
    winnerName: deleteField(),
    drawnAt: deleteField(),
  });
}

// ---------------------------------------------------------------------------
// Session — single "current" doc admin flips to signal that the draw is
// about to start. Public /lutrija watches this and reveals the bubanj.

export async function setLotteryDrumVisible(
  tournamentId: string,
  visible: boolean,
  updatedBy: string,
): Promise<void> {
  await setDoc(
    lotterySessionDoc(tournamentId),
    {
      drumVisible: visible,
      updatedAt: serverTimestamp(),
      updatedBy,
    } as unknown as LotterySession,
    { merge: true },
  );
}
