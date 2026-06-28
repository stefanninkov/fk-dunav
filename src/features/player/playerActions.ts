import {
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { playerDoc, playersCol } from '@/lib/firestore/refs';
import type { Player } from '@/lib/firestore/types';
import { stripUndefined } from '@/lib/utils/stripUndefined';

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
  batch.set(
    ref,
    stripUndefined({
      firstName: input.firstName,
      lastName: input.lastName,
      displayName,
      teamId: input.teamId,
      teamName: input.teamName,
      photoUrl: input.photoUrl,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }) as unknown as Player,
  );
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

// ---------------------------------------------------------------------------
// Roster sync — used by the TeamEditor so the admin can add / edit / remove
// players inline while creating or editing a team. Diffs the incoming row
// list against what's currently in Firestore and applies only the needed
// writes inside a single batch.

export interface RosterRow {
  /** Existing player id, or empty for a new row. */
  id?: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
}

export async function savePlayerRoster(
  tournamentId: string,
  teamId: string,
  teamName: string,
  rows: RosterRow[],
): Promise<void> {
  // Load current roster so we know what to delete.
  const existingSnap = await getDocs(
    query(playersCol(tournamentId), where('teamId', '==', teamId)),
  );
  const existingIds = new Set<string>(existingSnap.docs.map((d) => d.id));

  const batch = writeBatch(db);

  // Upsert every incoming row.
  const seen = new Set<string>();
  for (const row of rows) {
    const firstName = row.firstName.trim();
    const lastName = row.lastName.trim();
    if (!firstName && !lastName) continue; // skip empty rows
    const displayName = `${firstName} ${lastName}`.trim();
    const photoUrl = row.photoUrl?.trim();

    if (row.id && existingIds.has(row.id)) {
      seen.add(row.id);
      batch.update(
        playerDoc(tournamentId, row.id),
        stripUndefined({
          firstName,
          lastName,
          displayName,
          teamId,
          teamName,
          photoUrl: photoUrl || undefined,
          active: true,
          updatedAt: serverTimestamp(),
        }),
      );
    } else {
      const newRef = doc(playersCol(tournamentId));
      batch.set(
        newRef,
        stripUndefined({
          firstName,
          lastName,
          displayName,
          teamId,
          teamName,
          photoUrl: photoUrl || undefined,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }) as unknown as Player,
      );
    }
  }

  // Rows that existed but aren't in the new list → hard delete. Match
  // events store player name denormalized, so removing the player doc is
  // safe and keeps the roster tidy.
  for (const id of existingIds) {
    if (!seen.has(id)) batch.delete(playerDoc(tournamentId, id));
  }

  await batch.commit();
}

export async function deleteTeamRoster(
  tournamentId: string,
  teamId: string,
): Promise<void> {
  const existingSnap = await getDocs(
    query(playersCol(tournamentId), where('teamId', '==', teamId)),
  );
  if (existingSnap.empty) return;
  const batch = writeBatch(db);
  for (const d of existingSnap.docs) {
    batch.delete(d.ref);
  }
  await batch.commit();
}
