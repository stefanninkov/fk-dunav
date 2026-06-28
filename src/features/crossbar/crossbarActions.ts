import {
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { crossbarCol, crossbarDoc } from '@/lib/firestore/refs';
import type { CrossbarParticipant } from '@/lib/firestore/types';
import { stripUndefined } from '@/lib/utils/stripUndefined';

export interface CreateCrossbarInput {
  name: string;
  teamId?: string;
  teamName?: string;
  qualifyingScore?: number;
  finalRank?: number;
  notes?: string;
}

export async function createCrossbarParticipant(
  tournamentId: string,
  input: CreateCrossbarInput,
): Promise<string> {
  const ref = doc(crossbarCol(tournamentId));
  const batch = writeBatch(db);
  batch.set(ref, stripUndefined(input) as unknown as CrossbarParticipant);
  await batch.commit();
  return ref.id;
}

export async function updateCrossbarParticipant(
  tournamentId: string,
  id: string,
  patch: Partial<CreateCrossbarInput>,
): Promise<void> {
  await updateDoc(crossbarDoc(tournamentId, id), stripUndefined(patch));
}

export async function deleteCrossbarParticipant(
  tournamentId: string,
  id: string,
): Promise<void> {
  await deleteDoc(crossbarDoc(tournamentId, id));
}
