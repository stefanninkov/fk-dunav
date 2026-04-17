import {
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { inviteDoc, invitesCol } from '@/lib/firestore/refs';
import type { Invite, InviteRole } from '@/lib/firestore/types';

/**
 * Create an invite for a given email + role. The doc id is the lower-cased
 * email so promoteAdminOnLogin and the rules-less client-side fallback can
 * look it up cheaply (no need to query). Revoked invites are kept for audit.
 */
export async function inviteUser(
  email: string,
  role: InviteRole,
  invitedBy: string,
): Promise<void> {
  const id = email.trim().toLowerCase();
  const ref = inviteDoc(id);
  const batch = writeBatch(db);
  batch.set(ref, {
    email: id,
    role,
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
