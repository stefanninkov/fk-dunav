import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import {
  adminEmailConverter,
  announcementConverter,
  appUserConverter,
  awardConverter,
  championConverter,
  contentPageConverter,
  crossbarConverter,
  fanPollConverter,
  inviteConverter,
  groupConverter,
  kupSankaConverter,
  lotteryParticipantConverter,
  lotteryPrizeConverter,
  lotterySessionConverter,
  matchConverter,
  matchEventConverter,
  photoConverter,
  playerConverter,
  pushSubscriptionConverter,
  sponsorConverter,
  teamConverter,
  tournamentConverter,
} from './converters';
import type {
  AdminEmail,
  Announcement,
  AppUser,
  Award,
  Champion,
  ContentPage,
  ContentPageId,
  CrossbarParticipant,
  FanPoll,
  FanPollId,
  Invite,
  Group,
  KupSankaEntry,
  LotteryParticipant,
  LotteryPrize,
  LotterySession,
  Match,
  MatchEvent,
  Photo,
  Player,
  PushSubscription,
  Sponsor,
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

export const championsCol = (): CollectionReference<Champion> =>
  collection(db, 'champions').withConverter(championConverter);

export const championDoc = (year: string): DocumentReference<Champion> =>
  doc(db, 'champions', year).withConverter(championConverter);

export const invitesCol = (): CollectionReference<Invite> =>
  collection(db, 'invites').withConverter(inviteConverter);

export const inviteDoc = (id: string): DocumentReference<Invite> =>
  doc(db, 'invites', id).withConverter(inviteConverter);

// Fan votes are tournament-scoped; one doc per poll id (mvp, bestGoal).
export const fanPollsCol = (tournamentId: string): CollectionReference<FanPoll> =>
  collection(db, 'tournaments', tournamentId, 'fanVotes').withConverter(fanPollConverter);

export const fanPollDoc = (
  tournamentId: string,
  pollId: FanPollId,
): DocumentReference<FanPoll> =>
  doc(db, 'tournaments', tournamentId, 'fanVotes', pollId).withConverter(fanPollConverter);

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

export const lotteryParticipantsCol = (
  tournamentId: string,
): CollectionReference<LotteryParticipant> =>
  collection(db, 'tournaments', tournamentId, 'lotteryParticipants').withConverter(
    lotteryParticipantConverter,
  );

export const lotteryParticipantDoc = (
  tournamentId: string,
  participantId: string,
): DocumentReference<LotteryParticipant> =>
  doc(db, 'tournaments', tournamentId, 'lotteryParticipants', participantId).withConverter(
    lotteryParticipantConverter,
  );

export const lotterySessionDoc = (
  tournamentId: string,
): DocumentReference<LotterySession> =>
  doc(db, 'tournaments', tournamentId, 'lotterySession', 'current').withConverter(
    lotterySessionConverter,
  );

export const announcementsCol = (
  tournamentId: string,
): CollectionReference<Announcement> =>
  collection(db, 'tournaments', tournamentId, 'announcements').withConverter(
    announcementConverter,
  );

export const announcementDoc = (
  tournamentId: string,
  id: string,
): DocumentReference<Announcement> =>
  doc(db, 'tournaments', tournamentId, 'announcements', id).withConverter(
    announcementConverter,
  );

export const sponsorsCol = (tournamentId: string): CollectionReference<Sponsor> =>
  collection(db, 'tournaments', tournamentId, 'sponsors').withConverter(sponsorConverter);

export const sponsorDoc = (
  tournamentId: string,
  id: string,
): DocumentReference<Sponsor> =>
  doc(db, 'tournaments', tournamentId, 'sponsors', id).withConverter(sponsorConverter);

export const kupSankaCol = (tournamentId: string): CollectionReference<KupSankaEntry> =>
  collection(db, 'tournaments', tournamentId, 'kupSanka').withConverter(kupSankaConverter);

export const kupSankaDoc = (
  tournamentId: string,
  teamId: string,
): DocumentReference<KupSankaEntry> =>
  doc(db, 'tournaments', tournamentId, 'kupSanka', teamId).withConverter(kupSankaConverter);

export const crossbarCol = (
  tournamentId: string,
): CollectionReference<CrossbarParticipant> =>
  collection(db, 'tournaments', tournamentId, 'crossbar').withConverter(crossbarConverter);

export const crossbarDoc = (
  tournamentId: string,
  id: string,
): DocumentReference<CrossbarParticipant> =>
  doc(db, 'tournaments', tournamentId, 'crossbar', id).withConverter(crossbarConverter);

export const awardsCol = (tournamentId: string): CollectionReference<Award> =>
  collection(db, 'tournaments', tournamentId, 'awards').withConverter(awardConverter);

export const awardDoc = (
  tournamentId: string,
  id: string,
): DocumentReference<Award> =>
  doc(db, 'tournaments', tournamentId, 'awards', id).withConverter(awardConverter);

// Top-level push subscriptions. Doc id = FCM registration token; the token
// is always unique per device, so using it as the id means the client can
// idempotently upsert its own subscription doc via setDoc+merge.
export const pushSubscriptionsCol = (): CollectionReference<PushSubscription> =>
  collection(db, 'pushSubscriptions').withConverter(pushSubscriptionConverter);

export const pushSubscriptionDoc = (
  token: string,
): DocumentReference<PushSubscription> =>
  doc(db, 'pushSubscriptions', token).withConverter(pushSubscriptionConverter);

export const photosCol = (tournamentId: string): CollectionReference<Photo> =>
  collection(db, 'tournaments', tournamentId, 'photos').withConverter(photoConverter);

export const photoDoc = (
  tournamentId: string,
  photoId: string,
): DocumentReference<Photo> =>
  doc(db, 'tournaments', tournamentId, 'photos', photoId).withConverter(photoConverter);

// Admin-editable markdown pages, one doc per page id.
export const contentPagesCol = (
  tournamentId: string,
): CollectionReference<ContentPage> =>
  collection(db, 'tournaments', tournamentId, 'content').withConverter(
    contentPageConverter,
  );

export const contentPageDoc = (
  tournamentId: string,
  pageId: ContentPageId,
): DocumentReference<ContentPage> =>
  doc(db, 'tournaments', tournamentId, 'content', pageId).withConverter(
    contentPageConverter,
  );
