import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import { storage } from '@/lib/firebase';
import { photoDoc, photosCol } from '@/lib/firestore/refs';
import type { Photo } from '@/lib/firestore/types';

export interface UploadInput {
  file: File;
  uploaderName?: string;
  matchId?: string;
  teamIds?: string[];
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  photoId: string;
}

export async function uploadPhoto(
  tournamentId: string,
  input: UploadInput,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  const photoId = doc(photosCol(tournamentId)).id;
  const safeName = input.file.name.replace(/[^\w.-]+/g, '_');
  const path = `uploads/pending/${photoId}/${safeName}`;
  const storageRef = ref(storage, path);

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, input.file, {
      contentType: input.file.type,
    });
    task.on(
      'state_changed',
      (s) =>
        onProgress?.({
          bytesTransferred: s.bytesTransferred,
          totalBytes: s.totalBytes,
          photoId,
        }),
      (err) => reject(err),
      () => resolve(),
    );
  });

  const fullUrl = await getDownloadURL(storageRef);
  const type = input.file.type.startsWith('video/') ? 'video' : 'image';

  await setDoc(photoDoc(tournamentId, photoId), {
    type,
    status: 'pending',
    storagePath: path,
    fullUrl,
    videoUrl: type === 'video' ? fullUrl : undefined,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    matchId: input.matchId,
    teamIds: input.teamIds ?? [],
    uploaderName: input.uploaderName,
    uploaderUserAgent: navigator.userAgent,
    uploadedAt: serverTimestamp(),
    takedownRequested: false,
  } as unknown as Photo);

  return photoId;
}

export async function approvePhoto(
  tournamentId: string,
  photoId: string,
  reviewedBy: string,
): Promise<void> {
  await updateDoc(photoDoc(tournamentId, photoId), {
    status: 'approved',
    reviewedBy,
    reviewedAt: serverTimestamp(),
  });
}

export async function rejectPhoto(
  tournamentId: string,
  photoId: string,
  reviewedBy: string,
  reason?: string,
): Promise<void> {
  await updateDoc(photoDoc(tournamentId, photoId), {
    status: 'rejected',
    reviewedBy,
    reviewedAt: serverTimestamp(),
    rejectionReason: reason,
  });
}

/**
 * Permanently delete a rejected submission's storage object + Firestore
 * doc. The Cloud Function daily purge handles the bulk case (older than
 * 7 days) — this is for manual admin cleanup.
 */
export async function purgePhoto(
  tournamentId: string,
  photo: Photo,
): Promise<void> {
  try {
    await deleteObject(ref(storage, photo.storagePath));
  } catch {
    /* file may already be gone — continue */
  }
  await updateDoc(photoDoc(tournamentId, photo.id), {
    takedownRequested: true,
    takedownReason: 'purged by admin',
  });
}
