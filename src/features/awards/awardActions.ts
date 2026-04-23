import {
  deleteDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { awardDoc } from '@/lib/firestore/refs';
import type { Award, AwardEntityType, AwardId } from '@/lib/firestore/types';
import { stripUndefined } from '@/lib/utils/stripUndefined';

export interface AwardInput {
  id: AwardId;
  type: AwardEntityType;
  teamId?: string;
  teamName?: string;
  playerId?: string;
  playerName?: string;
  playerPhotoUrl?: string;
  teamOfTournamentPlayerIds?: string[];
  description?: string;
}

/**
 * Upsert an award by its canonical id (champion / runnerUp / mvp / …).
 * Using known ids as doc ids makes `/awards/{id}` lookups cheap for the
 * public awards board and keeps one row per award.
 */
export async function setAward(
  tournamentId: string,
  input: AwardInput,
): Promise<void> {
  await setDoc(
    awardDoc(tournamentId, input.id),
    stripUndefined({
      type: input.type,
      teamId: input.teamId,
      teamName: input.teamName,
      playerId: input.playerId,
      playerName: input.playerName,
      playerPhotoUrl: input.playerPhotoUrl,
      teamOfTournamentPlayerIds: input.teamOfTournamentPlayerIds,
      description: input.description,
      awardedAt: serverTimestamp(),
    }) as unknown as Award,
    { merge: true },
  );
}

export async function deleteAward(
  tournamentId: string,
  id: AwardId,
): Promise<void> {
  await deleteDoc(awardDoc(tournamentId, id));
}
