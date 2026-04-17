import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { deleteDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { lotteryCol, lotteryDoc } from '@/lib/firestore/refs';
import type { LotteryPrize } from '@/lib/firestore/types';

export interface CreatePrizeInput {
  label: string;
  winnerName: string;
  winnerPhotoUrl?: string;
  order: number;
}

export async function createLotteryPrize(
  tournamentId: string,
  input: CreatePrizeInput,
  createdBy: string,
): Promise<string> {
  const ref = doc(lotteryCol(tournamentId));
  const batch = writeBatch(db);
  batch.set(ref, {
    label: input.label,
    winnerName: input.winnerName,
    winnerPhotoUrl: input.winnerPhotoUrl,
    order: input.order,
    awardedAt: serverTimestamp(),
    createdBy,
  } as unknown as LotteryPrize);
  await batch.commit();
  return ref.id;
}

export async function updateLotteryPrize(
  tournamentId: string,
  prizeId: string,
  patch: Partial<CreatePrizeInput>,
): Promise<void> {
  await updateDoc(lotteryDoc(tournamentId, prizeId), {
    ...patch,
  });
}

export async function deleteLotteryPrize(
  tournamentId: string,
  prizeId: string,
): Promise<void> {
  await deleteDoc(lotteryDoc(tournamentId, prizeId));
}
