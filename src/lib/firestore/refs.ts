import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import {
  adminEmailConverter,
  appUserConverter,
  groupConverter,
  lotteryPrizeConverter,
  matchConverter,
  matchEventConverter,
  playerConverter,
  teamConverter,
  tournamentConverter,
} from './converters';
import type {
  AdminEmail,
  AppUser,
  Group,
  LotteryPrize,
  Match,
  MatchEvent,
  Player,
  Team,
  Tournament,
} from './types';

/**
 * Typed Firestore references. Use these instead of calling `collection(db, ...)`
 * directly — they attach the converter so reads/writes are typed.
 *
 * Example:
 *   const snap = await getDoc(tournamentDoc(id));
 *   const t: Tournament | undefined = snap.data();
 */

// Top-level
export const tournamentsCol = (): CollectionReference<Tournament> =>
  collection(db, 'tournaments').withConverter(tournamentConverter);

export const tournamentDoc = (id: string): DocumentReference<Tournament> =>
  doc(db, 'tournaments', id).withConverter(tournamentConverter);

export const adminEmailsCol = (): CollectionReference<AdminEmail> =>
  collection(db, 'adminEmails').withConverter(adminEmailConverter);

export const usersCol = (): CollectionReference<AppUser> =>
  collection(db, 'users').withConverter(appUserConverter);

export const userDoc = (uid: string): DocumentReference<AppUser> =>
  doc(db, 'users', uid).withConverter(appUserConverter);

// Tournament-scoped
export const groupsCol = (tournamentId: string): CollectionReference<Group> =>
  collection(db, 'tournaments', tournamentId, 'groups').withConverter(groupConverter);

export const groupDoc = (tournamentId: string, groupId: string): DocumentReference<Group> =>
  doc(db, 'tournaments', tournamentId, 'groups', groupId).withConverter(groupConverter);

export const teamsCol = (tournamentId: string): CollectionReference<Team> =>
  collection(db, 'tournaments', tournamentId, 'teams').withConverter(teamConverter);

export const teamDoc = (tournamentId: string, teamId: string): DocumentReference<Team> =>
  doc(db, 'tournaments', tournamentId, 'teams', teamId).withConverter(teamConverter);

export const playersCol = (tournamentId: string): CollectionReference<Player> =>
  collection(db, 'tournaments', tournamentId, 'players').withConverter(playerConverter);

export const playerDoc = (tournamentId: string, playerId: string): DocumentReference<Player> =>
  doc(db, 'tournaments', tournamentId, 'players', playerId).withConverter(playerConverter);

export const matchesCol = (tournamentId: string): CollectionReference<Match> =>
  collection(db, 'tournaments', tournamentId, 'matches').withConverter(matchConverter);

export const matchDoc = (tournamentId: string, matchId: string): DocumentReference<Match> =>
  doc(db, 'tournaments', tournamentId, 'matches', matchId).withConverter(matchConverter);

export const matchEventsCol = (
  tournamentId: string,
  matchId: string,
): CollectionReference<MatchEvent> =>
  collection(db, 'tournaments', tournamentId, 'matches', matchId, 'events').withConverter(
    matchEventConverter,
  );

export const matchEventDoc = (
  tournamentId: string,
  matchId: string,
  eventId: string,
): DocumentReference<MatchEvent> =>
  doc(
    db,
    'tournaments',
    tournamentId,
    'matches',
    matchId,
    'events',
    eventId,
  ).withConverter(matchEventConverter);

export const lotteryCol = (tournamentId: string): CollectionReference<LotteryPrize> =>
  collection(db, 'tournaments', tournamentId, 'lottery').withConverter(lotteryPrizeConverter);

export const lotteryDoc = (
  tournamentId: string,
  prizeId: string,
): DocumentReference<LotteryPrize> =>
  doc(db, 'tournaments', tournamentId, 'lottery', prizeId).withConverter(lotteryPrizeConverter);
