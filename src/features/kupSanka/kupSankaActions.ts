import {
  deleteDoc,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { kupSankaCol, kupSankaDoc } from '@/lib/firestore/refs';
import type { KupSankaEntry } from '@/lib/firestore/types';

/**
 * Kup Šanka entries are free-form — they represent any participant the admin
 * wants to track (a tournament team, a visiting team, a friend, etc.), not
 * just the teams registered for the tournament.
 */

export async function createKupSankaEntry(
  tournamentId: string,
  input: { name: string; note?: string },
  updatedBy: string,
): Promise<string> {
  const ref = doc(kupSankaCol(tournamentId));
  const note = input.note?.trim();
  await setDoc(ref, {
    name: input.name.trim(),
    ...(note ? { note } : {}),
    bokala: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy,
  } as unknown as KupSankaEntry);
  return ref.id;
}

export async function setBokala(
  tournamentId: string,
  entryId: string,
  bokala: number,
  updatedBy: string,
): Promise<void> {
  await updateDoc(kupSankaDoc(tournamentId, entryId), {
    bokala: Math.max(0, bokala),
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}

export async function updateKupSankaEntry(
  tournamentId: string,
  entryId: string,
  patch: { name?: string; note?: string },
  updatedBy: string,
): Promise<void> {
  const trimmedNote = patch.note?.trim();
  await updateDoc(kupSankaDoc(tournamentId, entryId), {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.note !== undefined
      ? { note: trimmedNote ? trimmedNote : deleteField() }
      : {}),
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}

export async function deleteKupSankaEntry(
  tournamentId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(kupSankaDoc(tournamentId, entryId));
}
