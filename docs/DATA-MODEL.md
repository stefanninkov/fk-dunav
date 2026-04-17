# DATA-MODEL.md — Firestore Schema

This document defines every collection, subcollection, document field, and index. It is the single source of truth for the database. If you need a field not defined here, add it here first with type and rationale, then implement.

**Conventions:**
- Document IDs are auto-generated UUIDs unless noted.
- All timestamps are Firestore `Timestamp`, stored via `serverTimestamp()` on write.
- Soft deletes use a `deletedAt` field (null = active). Hard deletes only for draft/unsaved items.
- Denormalization is preferred over joins — we duplicate team name + logo into match docs so public reads stay cheap.

---

## 1. Top-level collections

### 1.1 `/tournaments/{tournamentId}`
One doc per tournament edition. Only one has `status: 'active'` at a time.

```ts
interface Tournament {
  id: string;
  slug: string;                    // url-safe, e.g. "2026"
  name: string;                    // "Prvi Ostrovački turnir u malom fudbalu na travi"
  subtitle?: string;               // "Pokaži lali umeće na travi"
  edition: number;                 // 2 (2nd edition, after 2025)
  year: number;                    // 2026
  startDate: Timestamp;
  endDate: Timestamp;
  location: {
    name: string;                  // "FK Dunav stadion, Ostrovo"
    lat?: number;
    lng?: number;
  };
  status: 'draft' | 'active' | 'archived';
  config: {
    fields: string[];              // ["Teren 1", "Teren 2"]
    matchFormat: {
      halves: number;              // 2
      halfDurationSeconds: number; // 600 = 10 min
      extraTimeEnabled: boolean;   // false for small-sided
      shootoutRequired: boolean;   // true for knockout
    };
    qualifiersPerGroup: number;    // 2 (top 2 advance to knockout)
    tiebreakerOrder: Array<'h2h' | 'gd' | 'gf' | 'ga'>;  // ["h2h", "gd", "gf"]
  };
  sideCompetitions: {
    kupSanka: boolean;
    crossbar: boolean;
    mvpVoting: boolean;
    bestGoalVoting: boolean;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;               // uid of admin who created
  deletedAt: Timestamp | null;
}
```

**Indexes:**
- `status` (single) — for querying the active tournament.
- `year` desc (single) — for history listing.

**Security:** read: public for active+archived, admins only for draft. Write: admin only.

---

### 1.2 `/tournaments/{id}/teams/{teamId}`

```ts
interface Team {
  id: string;
  name: string;                    // "Kličevac"
  shortName?: string;              // "KLČ" (for bracket display)
  logoUrl?: string;                // Firebase Storage URL
  groupId: string;                 // reference to /groups/{groupId}
  color?: string;                  // hex, for UI accent
  captainName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}
```

**Indexes:**
- `groupId` (single).
- `name` asc (single) — for searchable listing.

**Security:** read: public. Write: reporter+ for this tournament.

---

### 1.3 `/tournaments/{id}/groups/{groupId}`

```ts
interface Group {
  id: string;
  name: string;                    // "Grupa A"
  order: number;                   // 0, 1, 2... for display order
  createdAt: Timestamp;
}
```

**Security:** read: public. Write: admin only.

---

### 1.4 `/tournaments/{id}/players/{playerId}`

Players live at tournament level because rosters are tournament-specific.

```ts
interface Player {
  id: string;
  firstName: string;               // "Ivan"
  lastName: string;                // "Tekić"
  displayName: string;             // computed: "Ivan Tekić"
  photoUrl?: string;
  teamId: string;                  // reference to /teams/{teamId}
  teamName: string;                // denormalized for fast reads
  createdAt: Timestamp;
  updatedAt: Timestamp;
  active: boolean;                 // false = soft-removed from tournament
}
```

**Indexes:**
- `teamId` (single).
- `teamId + active` (composite) — for team roster queries.
- `lastName` asc (single) — for search.

**Security:** read: public. Write: reporter+.

---

### 1.5 `/tournaments/{id}/matches/{matchId}`

The core match document. Denormalizes team data for fast public reads.

```ts
interface Match {
  id: string;
  tournamentId: string;
  phase: 'group' | 'knockout';
  groupId?: string;                // only for group phase
  knockoutRound?: 'qf' | 'sf' | 'final' | 'thirdPlace';  // only for knockout
  bracketSlot?: string;            // e.g. "QF1" — for bracket tree placement

  field: string;                   // "Teren 1"
  scheduledStart: Timestamp;
  actualStart?: Timestamp;         // when reporter tapped "Počni"
  actualEnd?: Timestamp;           // when reporter tapped "Završi"

  teamA: TeamSnapshot;
  teamB: TeamSnapshot;

  score: { a: number; b: number };          // running score, updated as events log
  shootoutScore?: { a: number; b: number }; // only if went to penalties

  status: 'scheduled' | 'live' | 'finished' | 'abandoned';

  clock: {
    state: 'idle' | 'running' | 'paused' | 'halftime' | 'ended';
    currentHalf: 1 | 2;
    halfStartedAt: Timestamp | null;   // server time when current half resumed
    accumulatedSeconds: number;        // seconds played in current half before last pause
    displayMinute: number;             // what to show in UI
  };

  lineups?: {                      // optional, enterable pre-match
    a: string[];                   // player IDs
    b: string[];                   // player IDs
  };

  motmPlayerId?: string;           // man of the match (optional)
  attendance?: number;             // optional, rarely tracked
  notes?: string;                  // reporter's free-text notes

  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: string;              // uid of last reporter to touch it
  lockedForEdit: boolean;          // true after admin finalization; blocks further edits
}

interface TeamSnapshot {
  teamId: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  groupId?: string;
}
```

**Indexes:**
- `status` (single) — for "currently live" queries.
- `scheduledStart` asc (single) — for schedule sort.
- `phase + scheduledStart` (composite).
- `tournamentId + status` (composite).

**Security:** read: public. Write: reporter+ (own tournament only), admin for `lockedForEdit` toggle.

---

### 1.6 `/tournaments/{id}/matches/{matchId}/events/{eventId}`

Append-only event log. The source of truth for what happened in the match. The parent `match.score` is derived from these events by Cloud Function (or client calc on write if reliable).

```ts
type EventType =
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

interface MatchEvent {
  id: string;
  matchId: string;
  clientEventId: string;           // UUID generated on client for idempotency
  type: EventType;
  minute: number;                  // gameplay minute (editable by reporter)
  loggedAt: Timestamp;             // reporter's local clock at log time
  serverTimestamp: Timestamp;      // set by serverTimestamp() on write

  team?: 'a' | 'b';                // which team (for goals, cards)
  playerId?: string;               // scorer / carded player
  playerName?: string;             // denormalized for public reads
  assistPlayerId?: string;
  assistPlayerName?: string;
  ownGoal?: boolean;               // default false

  // substitution-specific
  subOffPlayerId?: string;
  subOffPlayerName?: string;
  subOnPlayerId?: string;
  subOnPlayerName?: string;

  // shootout-specific
  shootoutKickNumber?: number;     // 1, 2, 3...
  shootoutScored?: boolean;

  // moderation
  createdBy: string;               // uid
  deleted: boolean;                // soft-delete flag (admin-only mutation)
  deletedAt?: Timestamp;
  deletedBy?: string;
}
```

**Indexes:**
- `matchId + minute asc` (composite).
- `matchId + deleted + minute asc` (composite) — for public reads that exclude deleted.

**Security:** read: public where `deleted == false`. Write (create): reporter+. Update (soft-delete): admin only.

---

### 1.7 `/tournaments/{id}/standings/{teamId}`

Computed standings per team. Written by Cloud Function on match finalization, not manually. Exists so public reads are a simple collection query, not an aggregation.

```ts
interface Standing {
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  groupId: string;
  groupName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  // Tiebreaker-related aggregations:
  h2hRecords: { [otherTeamId: string]: { wins: number; draws: number; losses: number; gf: number; ga: number } };
  rank: number;                    // 1-indexed within group, computed after tiebreakers
  qualifiesForKnockout: boolean;
  updatedAt: Timestamp;
}
```

**Indexes:**
- `groupId + rank asc` (composite).
- `groupId + points desc + goalDifference desc + goalsFor desc` (composite) — precomputed sort.

**Security:** read: public. Write: Cloud Functions only.

---

### 1.8 `/tournaments/{id}/photos/{photoId}`

```ts
interface Photo {
  id: string;
  type: 'image' | 'video';
  status: 'pending' | 'approved' | 'rejected';
  storagePath: string;             // /uploads/pending/... or /uploads/approved/...
  thumbnailUrl?: string;           // 400px
  mediumUrl?: string;              // 1200px
  fullUrl: string;                 // original
  videoUrl?: string;               // for videos, the playable URL
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;        // for videos

  // tagging (optional on upload, editable by admin)
  matchId?: string;
  teamIds: string[];
  day?: 'saturday' | 'sunday' | string;

  // uploader info
  uploaderName?: string;           // they can credit themselves (optional)
  uploaderIp: string;              // recorded for rate-limiting + abuse prevention
  uploaderUserAgent: string;
  uploadedAt: Timestamp;

  // moderation
  reviewedBy?: string;             // uid of admin who approved/rejected
  reviewedAt?: Timestamp;
  rejectionReason?: string;

  // takedown
  takedownRequested: boolean;
  takedownReason?: string;
}
```

**Indexes:**
- `status + uploadedAt desc` (composite).
- `matchId + status` (composite).
- `teamIds array-contains + status` (composite).

**Security:** read: public where `status == 'approved'`, admin for all. Write: create = anyone (with App Check + rate limit via Cloud Function); update = admin only.

---

### 1.9 `/tournaments/{id}/announcements/{id}`

```ts
interface Announcement {
  id: string;
  title: string;
  body: string;                    // max 280 chars
  severity: 'info' | 'warning' | 'urgent';
  publishedAt: Timestamp;
  expiresAt?: Timestamp;           // optional auto-expiry
  createdBy: string;
  pushSent: boolean;               // true after Cloud Function fires broadcast push
}
```

**Security:** read: public. Write: admin only.

---

### 1.10 `/tournaments/{id}/sponsors/{id}`

```ts
interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  link?: string;                   // external URL
  tier: 'gold' | 'silver' | 'bronze' | 'friend';
  order: number;                   // display order within tier
  thanksText?: string;             // optional message shown on sponsor page
  active: boolean;
}
```

**Security:** read: public. Write: admin only.

---

### 1.11 `/tournaments/{id}/kupSanka/{teamId}`

```ts
interface KupSankaEntry {
  teamId: string;                  // same ID as the team
  teamName: string;                // denormalized
  teamLogoUrl?: string;
  bokala: number;                  // beer mug count
  updatedAt: Timestamp;
  updatedBy: string;
}
```

**Security:** read: public. Write: reporter+.

---

### 1.12 `/tournaments/{id}/crossbar/{participantId}`

```ts
interface CrossbarParticipant {
  id: string;
  name: string;                    // can be player or external participant
  teamId?: string;                 // if they're on a tournament team
  qualifyingScore?: number;        // e.g. crossbar hits out of 5 shots
  finalRank?: number;              // 1 = winner
  notes?: string;
}
```

**Security:** read: public. Write: admin only (side comp is lower priority).

---

### 1.13 `/tournaments/{id}/awards/{awardId}`

```ts
interface Award {
  id: string;                      // e.g. 'champion', 'runnerUp', 'thirdPlace', 'mvp', 'topScorer', 'teamOfTournament'
  type: 'team' | 'player' | 'teamOfTournament';
  teamId?: string;
  teamName?: string;
  playerId?: string;
  playerName?: string;
  playerPhotoUrl?: string;
  teamOfTournamentPlayerIds?: string[];  // for team of the tournament
  description?: string;
  awardedAt: Timestamp;
}
```

**Security:** read: public. Write: admin only.

---

### 1.14 `/tournaments/{id}/fanVotes/{pollId}`

One doc per poll (`mvp`, `bestGoal`).

```ts
interface FanVotePoll {
  id: 'mvp' | 'bestGoal';
  title: string;
  status: 'closed' | 'open';
  openedAt?: Timestamp;
  closesAt?: Timestamp;
  candidates: Array<{
    id: string;                    // playerId or matchEventId for bestGoal
    label: string;                 // display name
    imageUrl?: string;
    voteCount: number;             // denormalized counter
  }>;
}
```

Individual votes stored in subcollection `/tournaments/{id}/fanVotes/{pollId}/votes/{voteId}` with `deviceId` (from a cookie) and `candidateId`. One vote per deviceId enforced by security rule.

**Security:** read: public. Write: anyone with App Check, 1 write per deviceId enforced via rule + a lookup.

---

## 2. Top-level collections (not tournament-scoped)

### 2.1 `/users/{uid}`

Profile data for reporters and admins. Roles are in Firebase Auth custom claims, not here.

```ts
interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  notes?: string;                  // admin notes about this reporter
}
```

**Security:** read: the user themselves, or admin. Write: the user (own doc, limited fields) or admin.

---

### 2.2 `/invites/{inviteId}`

Pending reporter invites.

```ts
interface Invite {
  id: string;
  email: string;
  role: 'reporter' | 'admin';
  invitedBy: string;               // uid
  invitedAt: Timestamp;
  consumedAt?: Timestamp;          // set when first login happens
  consumedByUid?: string;
  revoked: boolean;
}
```

**Security:** read/write: admin only.

---

### 2.3 `/pushSubscriptions/{token}`

FCM tokens linked to followed match IDs.

```ts
interface PushSubscription {
  token: string;                   // FCM registration token
  deviceId: string;                // anonymous device cookie
  matchIds: string[];              // subscribed matches
  subscribedToBroadcasts: boolean; // true = gets urgent announcements
  userAgent: string;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  invalid: boolean;                // marked true when FCM returns token-not-registered
}
```

**Indexes:**
- `matchIds array-contains + invalid == false` (composite) — used by notification Cloud Function.

**Security:** write (create/update): anyone with App Check (own token only, enforced by doc ID == token). Read: none (only Cloud Functions read this).

---

### 2.4 `/uploadAttempts/{ipHash}`

Used for anonymous upload rate limiting. `ipHash` = SHA-256 of client IP.

```ts
interface UploadAttempt {
  ipHash: string;
  firstAttemptAt: Timestamp;       // rolling window start
  count: number;                   // uploads in current hour
  blocked: boolean;                // manually set by admin to ban abusive IPs
}
```

**Security:** read/write: Cloud Functions only.

---

### 2.5 `/adminEmails/{docId}`

Seed data for admin bootstrap. Editable via Firebase console only.

```ts
interface AdminEmail {
  email: string;
  addedAt: Timestamp;
  addedBy: string;                 // 'bootstrap' for first, uid after
}
```

**Security:** read: admin only. Write: admin only (first seed in console).

---

## 3. Storage layout

```
/uploads/
  pending/{photoId}/
    original.{ext}
    thumbnail.jpg          ← generated by resize extension
    medium.jpg
  approved/{photoId}/
    (same structure, moved from pending on approval)
  rejected/{photoId}/     ← held 7-30 days before purge

/team-logos/{teamId}.{ext}
/player-photos/{playerId}.{ext}
/sponsor-logos/{sponsorId}.{ext}
/og-cards/{matchId}.png    ← generated by Cloud Function on match status change

/tournament-assets/{tournamentId}/
  (hero-image.jpg, banner.jpg, etc.)
```

All storage paths enforced by `storage.rules` — see `SECURITY-RULES.md`.

---

## 4. Derived / computed data

Computed by Cloud Functions, never edited by hand:

| Collection | Triggered by | Function |
|---|---|---|
| `/standings` | match finalized | recompute group standings for both teams' group, apply tiebreakers |
| `match.score` | event create/delete | recount from events |
| `photos/*` resized images | storage upload | Firebase Extension: resize images |
| `/og-cards/{matchId}.png` | match status change | generate social card PNG |
| `fanVotePoll.candidates[i].voteCount` | vote create | atomic counter increment |
| Top scorers list | match event create (goal) | aggregate via query or a cached `/tournaments/{id}/stats/topScorers` doc |

---

## 5. Required Firestore indexes (composite)

Define in `firestore.indexes.json`:

```json
{
  "indexes": [
    { "collectionGroup": "matches", "fields": [
      { "fieldPath": "phase", "order": "ASCENDING" },
      { "fieldPath": "scheduledStart", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "matches", "fields": [
      { "fieldPath": "tournamentId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "events", "fields": [
      { "fieldPath": "matchId", "order": "ASCENDING" },
      { "fieldPath": "deleted", "order": "ASCENDING" },
      { "fieldPath": "minute", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "players", "fields": [
      { "fieldPath": "teamId", "order": "ASCENDING" },
      { "fieldPath": "active", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "photos", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "uploadedAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "photos", "fields": [
      { "fieldPath": "matchId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "standings", "fields": [
      { "fieldPath": "groupId", "order": "ASCENDING" },
      { "fieldPath": "rank", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "pushSubscriptions", "fields": [
      { "fieldPath": "matchIds", "arrayConfig": "CONTAINS" },
      { "fieldPath": "invalid", "order": "ASCENDING" }
    ]}
  ]
}
```

---

## 6. Denormalization principles

- **Team names and logos** are duplicated into `Match`, `Player`, `Standing`, and `KupSankaEntry`. When a team is renamed, a Cloud Function fans out the update (`onTeamUpdate`).
- **Player names** are duplicated into `MatchEvent`. Same fan-out on rename.
- **Scores** are computed from events. The `match.score` field is a cache; always treat events as canonical if they disagree.
- **Standings** are a cache. On any match finalization or event edit by admin, recompute.
