import {
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { sponsorDoc, sponsorsCol } from '@/lib/firestore/refs';
import type { Sponsor, SponsorTier } from '@/lib/firestore/types';
import { stripUndefined } from '@/lib/utils/stripUndefined';

export interface CreateSponsorInput {
  name: string;
  logoUrl?: string;
  link?: string;
  tier: SponsorTier;
  order: number;
  thanksText?: string;
  active: boolean;
}

export async function createSponsor(
  tournamentId: string,
  input: CreateSponsorInput,
): Promise<string> {
  const ref = doc(sponsorsCol(tournamentId));
  const batch = writeBatch(db);
  batch.set(ref, stripUndefined(input) as unknown as Sponsor);
  await batch.commit();
  return ref.id;
}

export async function updateSponsor(
  tournamentId: string,
  id: string,
  patch: Partial<CreateSponsorInput>,
): Promise<void> {
  await updateDoc(sponsorDoc(tournamentId, id), stripUndefined(patch));
}

export async function deleteSponsor(
  tournamentId: string,
  id: string,
): Promise<void> {
  await deleteDoc(sponsorDoc(tournamentId, id));
}
