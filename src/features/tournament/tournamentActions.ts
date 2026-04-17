import {
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import {
  groupsCol,
  tournamentDoc,
  tournamentsCol,
} from '@/lib/firestore/refs';
import type {
  Tournament,
  TournamentConfig,
  TournamentLocation,
  TournamentSideCompetitions,
} from '@/lib/firestore/types';

export interface CreateTournamentInput {
  slug: string;
  name: string;
  subtitle?: string;
  edition: number;
  year: number;
  startDate: Date;
  endDate: Date;
  location: TournamentLocation;
  config: TournamentConfig;
  sideCompetitions: TournamentSideCompetitions;
}

/** Default config for a new FK Dunav tournament. */
export const defaultTournamentConfig: TournamentConfig = {
  fields: ['Teren 1', 'Teren 2'],
  matchFormat: {
    halves: 2,
    halfDurationSeconds: 600, // 10 minutes
    extraTimeEnabled: false,
    shootoutRequired: true,
  },
  qualifiersPerGroup: 2,
  tiebreakerOrder: ['h2h', 'gd', 'gf'],
};

export const defaultSideCompetitions: TournamentSideCompetitions = {
  kupSanka: true,
  crossbar: true,
  mvpVoting: true,
  bestGoalVoting: true,
};

/**
 * Create a new tournament in `draft` status. Admin activates it separately
 * via `activateTournament` — there can only be one `active` tournament at a
 * time and the activation transaction enforces that.
 */
export async function createTournament(
  input: CreateTournamentInput,
  createdBy: string,
): Promise<string> {
  const ref = doc(tournamentsCol());
  const now = serverTimestamp();
  const tournament: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    slug: input.slug,
    name: input.name,
    subtitle: input.subtitle,
    edition: input.edition,
    year: input.year,
    startDate: Timestamp.fromDate(input.startDate),
    endDate: Timestamp.fromDate(input.endDate),
    location: input.location,
    status: 'draft',
    config: input.config,
    sideCompetitions: input.sideCompetitions,
    createdAt: now,
    updatedAt: now,
    createdBy,
    deletedAt: null,
  };
  const batch = writeBatch(db);
  batch.set(ref, tournament as unknown as Tournament);
  await batch.commit();
  return ref.id;
}

/**
 * Flip the given tournament to `active`. Any other tournament currently
 * active is demoted to `archived` in the same transaction. This guarantees
 * the one-active invariant even under concurrent admin edits.
 */
export async function activateTournament(tournamentId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const target = tournamentDoc(tournamentId);
    const targetSnap = await tx.get(target);
    if (!targetSnap.exists()) throw new Error('Tournament not found');

    // Demote any other active tournaments (read outside tx, but write inside).
    const activeQuery = query(tournamentsCol(), where('status', '==', 'active'));
    const activeSnap = await getDocs(activeQuery);
    activeSnap.docs.forEach((d) => {
      if (d.id !== tournamentId) {
        tx.update(d.ref, { status: 'archived', updatedAt: serverTimestamp() });
      }
    });

    tx.update(target, { status: 'active', updatedAt: serverTimestamp() });
  });
}

export async function archiveTournament(tournamentId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = tournamentDoc(tournamentId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tournament not found');
    tx.update(ref, { status: 'archived', updatedAt: serverTimestamp() });
  });
}

/**
 * Create a new group inside a tournament. Order defaults to the number of
 * existing groups (so new groups append at the end); admin can reorder later.
 */
export async function createGroup(
  tournamentId: string,
  name: string,
  order: number,
): Promise<string> {
  const ref = doc(groupsCol(tournamentId));
  const batch = writeBatch(db);
  batch.set(ref, {
    name,
    order,
    createdAt: serverTimestamp(),
  } as never);
  await batch.commit();
  return ref.id;
}
