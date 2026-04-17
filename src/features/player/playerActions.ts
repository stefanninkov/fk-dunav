import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { playerDoc, playersCol } from '@/lib/firestore/refs';
import type { Player } from '@/lib/firestore/types';

export interface CreatePlayerInput {
  firstName: string;
  lastName: string;
  teamId: string;
  teamName: string;
  photoUrl?: string;
}

export async function createPlayer(
  tournamentId: string,
  input: CreatePlayerInput,
): Promise<string> {
  const ref = doc(playersCol(tournamentId));
  const displayName = `${input.firstName} ${input.lastName}`.trim();
  const batch = writeBatch(db);
  batch.set(ref, {
    firstName: input.firstName,
    lastName: input.lastName,
    displayName,
    teamId: input.teamId,
    teamName: input.teamName,
    photoUrl: input.photoUrl,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as unknown as Player);
  await batch.commit();
  return ref.id;
}

export async function setPlayerActive(
  tournamentId: string,
  playerId: string,
  active: boolean,
): Promise<void> {
  await updateDoc(playerDoc(tournamentId, playerId), {
    active,
    updatedAt: serverTimestamp(),
  });
}
