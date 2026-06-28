import {
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { teamDoc, teamsCol } from '@/lib/firestore/refs';
import type { Team } from '@/lib/firestore/types';
import { stripUndefined } from '@/lib/utils/stripUndefined';

export interface CreateTeamInput {
  name: string;
  shortName?: string;
  groupId: string;
  color?: string;
  captainName?: string;
  logoUrl?: string;
}

export async function createTeam(
  tournamentId: string,
  input: CreateTeamInput,
): Promise<string> {
  const ref = doc(teamsCol(tournamentId));
  const batch = writeBatch(db);
  batch.set(
    ref,
    stripUndefined({
      name: input.name,
      shortName: input.shortName,
      groupId: input.groupId,
      color: input.color,
      captainName: input.captainName,
      logoUrl: input.logoUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deletedAt: null,
    }) as unknown as Team,
  );
  await batch.commit();
  return ref.id;
}

export async function updateTeam(
  tournamentId: string,
  teamId: string,
  patch: Partial<CreateTeamInput>,
): Promise<void> {
  await updateDoc(teamDoc(tournamentId, teamId), {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Soft-delete a team (sets `deletedAt`). We don't hard-delete because
 * matches may reference this team via denormalized `TeamSnapshot`, and we
 * want the history to stay intact.
 */
export async function softDeleteTeam(
  tournamentId: string,
  teamId: string,
): Promise<void> {
  await updateDoc(teamDoc(tournamentId, teamId), {
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
