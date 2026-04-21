import type { Timestamp } from 'firebase/firestore';

/**
 * Firestore entity types — mirror docs/DATA-MODEL.md exactly. When the schema
 * changes, update the doc FIRST, then these types, then the converters.
 *
 * Conventions:
 * - All doc ids are string (Firestore auto-id unless noted).
 * - `Timestamp` is the Firestore Timestamp class on the client; on write we
 *   use `serverTimestamp()` which ends up as a Timestamp after round-trip.
 * - Soft deletes use `deletedAt` (null when active); hard deletes are only
 *   allowed for drafts that never became authoritative.
 */

// ---------------------------------------------------------------------------
// Tournament

export type TournamentStatus = 'draft' | 'active' | 'archived';

export interface TournamentLocation {
  name: string;
  lat?: number;
  lng?: number;
}

export interface TournamentMatchFormat {
  halves: number;
  halfDurationSeconds: number;
  extraTimeEnabled: boolean;
  shootoutRequired: boolean;
}

export type TiebreakerKey = 'h2h' | 'gd' | 'gf' | 'ga';

export interface TournamentConfig {
  fields: string[];
  matchFormat: TournamentMatchFormat;
  qualifiersPerGroup: number;
  tiebreakerOrder: TiebreakerKey[];
}

export interface TournamentSideCompetitions {
  kupSanka: boolean;
  crossbar: boolean;
  mvpVoting: boolean;
  bestGoalVoting: boolean;
}

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  subtitle?: string;
  edition: number;
  year: number;
  startDate: Timestamp;
  endDate: Timestamp;
  location: TournamentLocation;
  status: TournamentStatus;
  config: TournamentConfig;
  sideCompetitions: TournamentSideCompetitions;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  deletedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Group

export interface Group {
  id: string;
  name: string;
  order: number;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Team

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  groupId: string;
  color?: string;
  captainName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Player

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  photoUrl?: string;
  teamId: string;
  teamName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Match

export type MatchPhase = 'group' | 'knockout';
export type KnockoutRound = 'qf' | 'sf' | 'final' | 'thirdPlace';
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'abandoned';
export type ClockState = 'idle' | 'running' | 'paused' | 'halftime' | 'ended';

export interface TeamSnapshot {
  teamId: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  groupId?: string;
}

export interface MatchClock {
  state: ClockState;
  currentHalf: 1 | 2;
  halfStartedAt: Timestamp | null;
  accumulatedSeconds: number;
  displayMinute: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  phase: MatchPhase;
  groupId?: string;
  knockoutRound?: KnockoutRound;
  bracketSlot?: string;

  field: string;
  scheduledStart: Timestamp;
  actualStart?: Timestamp;
  actualEnd?: Timestamp;

  teamA: TeamSnapshot;
  teamB: TeamSnapshot;

  score: { a: number; b: number };
  shootoutScore?: { a: number; b: number };

  status: MatchStatus;
  clock: MatchClock;
  lineups?: { a: string[]; b: string[] };
  motmPlayerId?: string;
  attendance?: number;
  notes?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: string;
  lockedForEdit: boolean;
}

// ---------------------------------------------------------------------------
// Match events

export type MatchEventType =
  | 'matchStart'
  | 'goal'
  | 'yellowCard'
  | 'redCard'
  | 'substitution'
  | 'halfEnd'
  | 'halfStart'
  | 'matchEnd'
  | 'shootoutKick'
  | 'abandoned';

export interface MatchEvent {
  id: string;
  matchId: string;
  clientEventId: string;
  type: MatchEventType;
  minute: number;
  loggedAt: Timestamp;
  serverTimestamp: Timestamp;

  team?: 'a' | 'b';
  playerId?: string;
  playerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  ownGoal?: boolean;

  subOffPlayerId?: string;
  subOffPlayerName?: string;
  subOnPlayerId?: string;
  subOnPlayerName?: string;

  shootoutKickNumber?: number;
  shootoutScored?: boolean;

  createdBy: string;
  deleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

// ---------------------------------------------------------------------------
// Photo / video (gallery + moderation)

export type PhotoStatus = 'pending' | 'approved' | 'rejected';
export type PhotoMediaType = 'image' | 'video';

export interface Photo {
  id: string;
  type: PhotoMediaType;
  status: PhotoStatus;
  storagePath: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  fullUrl: string;
  videoUrl?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  matchId?: string;
  teamIds: string[];
  day?: string;
  uploaderName?: string;
  uploaderUserAgent?: string;
  uploadedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  rejectionReason?: string;
  takedownRequested: boolean;
  takedownReason?: string;
}

// ---------------------------------------------------------------------------
// Content page (admin-editable markdown: /pravilnik, /o-turniru)

export type ContentPageId = 'pravilnik' | 'oTurniru' | 'archive2025';

export interface ContentPage {
  id: ContentPageId;
  title: string;
  body: string; // markdown
  updatedAt: Timestamp;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Announcement

export type AnnouncementSeverity = 'info' | 'warning' | 'urgent';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  publishedAt: Timestamp;
  expiresAt?: Timestamp | null;
  createdBy: string;
  pushSent: boolean;
}

// ---------------------------------------------------------------------------
// Sponsor

export type SponsorTier = 'gold' | 'silver' | 'bronze' | 'friend';

export interface Sponsor {
  id: string;
  name: string;
  logoUrl?: string;
  link?: string;
  tier: SponsorTier;
  order: number;
  thanksText?: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Kup Šanka (beer mug leaderboard)

export interface KupSankaEntry {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  bokala: number;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Crossbar competition

export interface CrossbarParticipant {
  id: string;
  name: string;
  teamId?: string;
  teamName?: string;
  qualifyingScore?: number;
  finalRank?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Awards

export type AwardId =
  | 'champion'
  | 'runnerUp'
  | 'thirdPlace'
  | 'mvp'
  | 'topScorer'
  | 'teamOfTournament'
  | 'crossbarWinner';

export type AwardEntityType = 'team' | 'player' | 'teamOfTournament';

export interface Award {
  id: string;
  type: AwardEntityType;
  teamId?: string;
  teamName?: string;
  playerId?: string;
  playerName?: string;
  playerPhotoUrl?: string;
  teamOfTournamentPlayerIds?: string[];
  description?: string;
  awardedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Lottery (Lutrija)
//
// Two collections:
//  - /tournaments/{tid}/lotteryParticipants/{pid}  — pool of people in the raffle
//  - /tournaments/{tid}/lottery/{prizeId}          — prizes, with winner set at draw
//
// Draw flow: admin enters participants + prizes ahead of time, then during the
// live event clicks "Izvuci" on a prize. The action picks a random participant
// not yet assigned to any other prize and writes {winnerParticipantId, winnerName,
// drawnAt} onto the prize doc. The public /lutrija page watches for new winners
// and plays a shuffle animation that settles on the name.

export interface LotteryParticipant {
  id: string;
  name: string;
  note?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface LotteryPrize {
  id: string;
  label: string;
  order: number;
  /** Denormalized participant id/name written when the admin draws. Absent => not drawn. */
  winnerParticipantId?: string;
  winnerName?: string;
  drawnAt?: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// Top-level, not tournament-scoped

export interface AdminEmail {
  email: string;
  addedAt?: Timestamp;
  addedBy?: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Invite (email → role grant on first sign-in)

export type InviteRole = 'reporter' | 'admin';

export interface Invite {
  id: string;
  email: string;
  role: InviteRole;
  invitedBy: string;
  invitedAt: Timestamp;
  consumedAt?: Timestamp;
  consumedByUid?: string;
  revoked: boolean;
}

// ---------------------------------------------------------------------------
// Fan vote poll

export type FanPollId = 'mvp' | 'bestGoal';
export type FanPollStatus = 'open' | 'closed';

export interface FanPollCandidate {
  id: string;
  label: string;
  imageUrl?: string;
  voteCount: number;
}

export interface FanPoll {
  id: FanPollId;
  title: string;
  status: FanPollStatus;
  openedAt?: Timestamp;
  closesAt?: Timestamp;
  candidates: FanPollCandidate[];
}

export interface FanVote {
  id: string;
  deviceId: string;
  candidateId: string;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Push subscription

export interface PushSubscription {
  token: string;
  deviceId: string;
  matchIds: string[];
  subscribedToBroadcasts: boolean;
  userAgent: string;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  invalid: boolean;
}
