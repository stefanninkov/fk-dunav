import {
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { inviteDoc, invitesCol, userDoc } from '@/lib/firestore/refs';
import type { Capability, Invite } from '@/lib/firestore/types';

/**
 * Create / refresh an invite for an email with a specific capability set.
 * Doc id is lowercased email so the rules can look it up cheaply in
 * get() without a query. Revoked invites stay on file for audit until
 * the admin explicitly removes them.
 */
export async function inviteUser(
  email: string,
  caps: Capability[],
  invitedBy: string,
): Promise<void> {
  const id = email.trim().toLowerCase();
  const ref = inviteDoc(id);
  const batch = writeBatch(db);
  batch.set(ref, {
    email: id,
    caps,
    invitedBy,
    invitedAt: serverTimestamp(),
    revoked: false,
  } as unknown as Invite);
  await batch.commit();
}

export async function revokeInvite(id: string): Promise<void> {
  await updateDoc(inviteDoc(id), { revoked: true });
}

export async function removeInvite(id: string): Promise<void> {
  await deleteDoc(doc(invitesCol(), id));
}

/**
 * Admin-side edit of an active staff user's capabilities. Writes
 * /users/{uid} directly (admin rule allows any update). Client-side
 * self-promotion can't change caps after initial sign-in.
 */
export async function updateUserCapabilities(
  uid: string,
  caps: Capability[],
): Promise<void> {
  await updateDoc(userDoc(uid), { caps });
}
