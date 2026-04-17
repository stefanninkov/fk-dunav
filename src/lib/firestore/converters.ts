import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type WithFieldValue,
} from 'firebase/firestore';

import type {
  AdminEmail,
  Announcement,
  AppUser,
  Award,
  CrossbarParticipant,
  Group,
  KupSankaEntry,
  LotteryPrize,
  Match,
  MatchEvent,
  Player,
  PushSubscription,
  Sponsor,
  Team,
  Tournament,
} from './types';

/**
 * Generic converter factory. Firestore converters exist so we never hand a
 * raw `DocumentData` through the app — every read is typed, every write is
 * shape-checked. `fromFirestore` strips Firestore-only fields we don't want
 * on the client (nothing today, placeholder for later).
 *
 * `toFirestore` is intentionally thin. Our writes are usually typed explicit
 * partials (see refs + mutation helpers); the converter just forwards them
 * and lets Firestore merge.
 */
function makeConverter<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore(value: WithFieldValue<T>): DocumentData {
      return value as DocumentData;
    },
    fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): T {
      const data = snap.data(options);
      return { ...(data as T), id: snap.id };
    },
  };
}

export const tournamentConverter  = makeConverter<Tournament>();
export const groupConverter       = makeConverter<Group>();
export const teamConverter        = makeConverter<Team>();
export const playerConverter      = makeConverter<Player>();
export const matchConverter       = makeConverter<Match>();
export const matchEventConverter  = makeConverter<MatchEvent>();
export const lotteryPrizeConverter = makeConverter<LotteryPrize>();
export const announcementConverter = makeConverter<Announcement>();
export const sponsorConverter      = makeConverter<Sponsor>();
export const kupSankaConverter     = makeConverter<KupSankaEntry>();
export const crossbarConverter     = makeConverter<CrossbarParticipant>();
export const awardConverter        = makeConverter<Award>();
export const adminEmailConverter   = makeConverter<AdminEmail>();
export const appUserConverter      = makeConverter<AppUser>();
export const pushSubscriptionConverter = makeConverter<PushSubscription>();
