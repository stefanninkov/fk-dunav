import { serverTimestamp, setDoc } from 'firebase/firestore';

import { kupSankaDoc } from '@/lib/firestore/refs';
import type { Team } from '@/lib/firestore/types';

/**
 * Upsert a Kup Šanka entry for a team. Uses teamId as the doc id so a team
 * always has exactly one row; increments happen via setDoc + merge. Denorm
 * teamName + logoUrl for cheap public reads.
 */
export async function setBokala(
  tournamentId: string,
  team: Team,
  bokala: number,
  updatedBy: string,
): Promise<void> {
  await setDoc(
    kupSankaDoc(tournamentId, team.id),
    {
      teamId: team.id,
      teamName: team.name,
      teamLogoUrl: team.logoUrl,
      bokala,
      updatedAt: serverTimestamp(),
      updatedBy,
    },
    { merge: true },
  );
}
