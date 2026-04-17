import {
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { announcementDoc, announcementsCol } from '@/lib/firestore/refs';
import type { Announcement, AnnouncementSeverity } from '@/lib/firestore/types';

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  expiresAt?: Date;
}

export async function createAnnouncement(
  tournamentId: string,
  input: CreateAnnouncementInput,
  createdBy: string,
): Promise<string> {
  const ref = doc(announcementsCol(tournamentId));
  const batch = writeBatch(db);
  batch.set(ref, {
    title: input.title,
    body: input.body,
    severity: input.severity,
    publishedAt: serverTimestamp(),
    expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
    createdBy,
    pushSent: false,
  } as unknown as Announcement);
  await batch.commit();
  return ref.id;
}

export async function updateAnnouncement(
  tournamentId: string,
  id: string,
  patch: Partial<CreateAnnouncementInput>,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.body !== undefined) body.body = patch.body;
  if (patch.severity !== undefined) body.severity = patch.severity;
  if (patch.expiresAt !== undefined)
    body.expiresAt = patch.expiresAt ? Timestamp.fromDate(patch.expiresAt) : null;
  await updateDoc(announcementDoc(tournamentId, id), body);
}

export async function deleteAnnouncement(
  tournamentId: string,
  id: string,
): Promise<void> {
  await deleteDoc(announcementDoc(tournamentId, id));
}
