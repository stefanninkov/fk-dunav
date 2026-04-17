# SECURITY-RULES.md — Firestore & Storage Security Rules

Security rules enforce the access model. The UI enforces UX expectations; the rules enforce the contract. **Never assume UI checks are enough.**

---

## 1. Access model summary

| Resource | Public read | Reporter read | Admin read | Public write | Reporter write | Admin write |
|---|---|---|---|---|---|---|
| Active tournament doc | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Draft tournament doc | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Archived tournament doc | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Teams | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Groups | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Players | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Matches (scheduled/live/finished) | ✅ | ✅ | ✅ | ❌ | ✅ (create/update; not lock toggle) | ✅ |
| Match events (deleted==false) | ✅ | ✅ | ✅ | ❌ | ✅ (create only) | ✅ |
| Match events (deleted==true) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ (soft-delete) |
| Standings | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ (Cloud Functions only) |
| Photos (approved) | ✅ | ✅ | ✅ | ❌ (only via rate-limited function) | ❌ | ❌ |
| Photos (pending/rejected) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Announcements | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Sponsors | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Kup Šanka entries | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Crossbar participants | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Awards | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Fan vote polls | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Fan votes subcollection | ❌ | ❌ | ✅ | ✅ (1 per device) | ❌ | ❌ |
| Users | ❌ | Self only | ✅ | ❌ | Self limited | ✅ |
| Invites | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Push subscriptions | ❌ | ❌ | ❌ (functions read) | ✅ own token | ❌ | ❌ |
| Upload attempts | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (functions only) |
| Admin emails | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |

---

## 2. Helper functions (Firestore rules)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Auth helpers ──────────────────────────────────────────────
    function isSignedIn() {
      return request.auth != null;
    }

    function hasRole(role) {
      return isSignedIn() && request.auth.token[role] == true;
    }

    function isReporter() {
      return hasRole('reporter') || hasRole('admin');
    }

    function isAdmin() {
      return hasRole('admin');
    }

    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    // ─── Data validation helpers ──────────────────────────────────
    function isValidTimestamp(field) {
      return field is timestamp;
    }

    function onlyChangedFields(allowedFields) {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(allowedFields);
    }

    function incomingHasFields(fields) {
      return request.resource.data.keys().hasAll(fields);
    }

    // ─── Tournament status helpers ────────────────────────────────
    function tournamentStatus(tid) {
      return get(/databases/$(database)/documents/tournaments/$(tid)).data.status;
    }

    function isActiveOrArchived(tid) {
      return tournamentStatus(tid) in ['active', 'archived'];
    }

    // ─── Match lock helper ────────────────────────────────────────
    function matchIsLocked(tid, mid) {
      return get(/databases/$(database)/documents/tournaments/$(tid)/matches/$(mid)).data.lockedForEdit == true;
    }
```

---

## 3. Full `firestore.rules` (reference implementation)

```js
    // ═════════════════════════════════════════════════════════════
    // TOURNAMENTS
    // ═════════════════════════════════════════════════════════════
    match /tournaments/{tid} {
      allow read: if resource.data.status in ['active', 'archived'] || isAdmin();
      allow create, update, delete: if isAdmin();

      // ───────────────────────────────────────────────────────────
      // TEAMS
      // ───────────────────────────────────────────────────────────
      match /teams/{teamId} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow create, update: if isReporter();
        allow delete: if isAdmin();
      }

      // ───────────────────────────────────────────────────────────
      // GROUPS
      // ───────────────────────────────────────────────────────────
      match /groups/{groupId} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow create, update, delete: if isAdmin();
      }

      // ───────────────────────────────────────────────────────────
      // PLAYERS
      // ───────────────────────────────────────────────────────────
      match /players/{playerId} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow create, update: if isReporter();
        allow delete: if isAdmin();
      }

      // ───────────────────────────────────────────────────────────
      // MATCHES
      // ───────────────────────────────────────────────────────────
      match /matches/{mid} {
        allow read: if isActiveOrArchived(tid) || isAdmin();

        // Reporters can create + update, but cannot toggle lockedForEdit.
        allow create: if isReporter();

        allow update: if isReporter()
          && !matchIsLocked(tid, mid)
          && !('lockedForEdit' in request.resource.data.diff(resource.data).affectedKeys());

        allow update: if isAdmin();  // admin bypass (can toggle lock, can edit locked matches)

        allow delete: if isAdmin();

        // ─────────────────────────────────────────────────────────
        // MATCH EVENTS (append-only for reporters)
        // ─────────────────────────────────────────────────────────
        match /events/{eventId} {
          // Public reads exclude deleted events (enforced in query, not rule;
          // but rule hides deleted events from non-admins regardless).
          allow read: if (resource.data.deleted == false) || isAdmin();

          // Create: reporters only, required fields present, deleted must be false.
          allow create: if isReporter()
            && incomingHasFields(['type', 'minute', 'clientEventId', 'createdBy', 'deleted'])
            && request.resource.data.deleted == false
            && request.resource.data.createdBy == request.auth.uid
            && !matchIsLocked(tid, mid);

          // Update: admin only (soft-delete, edit minutes, etc.)
          allow update: if isAdmin();

          // Hard delete: never. Use soft-delete via update.
          allow delete: if false;
        }
      }

      // ───────────────────────────────────────────────────────────
      // STANDINGS (computed, writable only by functions)
      // ───────────────────────────────────────────────────────────
      match /standings/{teamId} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow write: if false;  // Cloud Functions bypass rules
      }

      // ───────────────────────────────────────────────────────────
      // PHOTOS
      // ───────────────────────────────────────────────────────────
      match /photos/{photoId} {
        allow read: if resource.data.status == 'approved' || isAdmin();

        // Public create is rejected here — only Cloud Function can create after rate-limit check.
        allow create: if false;

        allow update: if isAdmin();
        allow delete: if isAdmin();
      }

      // ───────────────────────────────────────────────────────────
      // ANNOUNCEMENTS
      // ───────────────────────────────────────────────────────────
      match /announcements/{id} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow write: if isAdmin();
      }

      // ───────────────────────────────────────────────────────────
      // SPONSORS
      // ───────────────────────────────────────────────────────────
      match /sponsors/{id} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow write: if isAdmin();
      }

      // ───────────────────────────────────────────────────────────
      // KUP ŠANKA
      // ───────────────────────────────────────────────────────────
      match /kupSanka/{teamId} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow write: if isReporter();
      }

      // ───────────────────────────────────────────────────────────
      // CROSSBAR
      // ───────────────────────────────────────────────────────────
      match /crossbar/{id} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow write: if isAdmin();
      }

      // ───────────────────────────────────────────────────────────
      // AWARDS
      // ───────────────────────────────────────────────────────────
      match /awards/{id} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow write: if isAdmin();
      }

      // ───────────────────────────────────────────────────────────
      // FAN VOTES
      // ───────────────────────────────────────────────────────────
      match /fanVotes/{pollId} {
        allow read: if isActiveOrArchived(tid) || isAdmin();
        allow update: if isAdmin();

        match /votes/{voteId} {
          // Public: one vote per device, enforced by matching voteId = deviceId.
          allow create: if request.resource.data.candidateId is string
            && request.resource.data.deviceId is string
            && voteId == request.resource.data.deviceId
            // Poll must be open
            && get(/databases/$(database)/documents/tournaments/$(tid)/fanVotes/$(pollId)).data.status == 'open';

          allow read: if isAdmin();
          allow update, delete: if false;
        }
      }
    }

    // ═════════════════════════════════════════════════════════════
    // USERS
    // ═════════════════════════════════════════════════════════════
    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();

      // User can create own profile on first login (limited fields).
      allow create: if isOwner(uid)
        && incomingHasFields(['uid', 'email', 'createdAt', 'lastLogin'])
        && request.resource.data.uid == uid;

      // User can update display name / photo only.
      allow update: if isOwner(uid)
        && onlyChangedFields(['displayName', 'photoUrl', 'lastLogin']);

      // Admin can edit notes, and anything else.
      allow update: if isAdmin();

      allow delete: if isAdmin();
    }

    // ═════════════════════════════════════════════════════════════
    // INVITES
    // ═════════════════════════════════════════════════════════════
    match /invites/{id} {
      allow read, write: if isAdmin();
    }

    // ═════════════════════════════════════════════════════════════
    // PUSH SUBSCRIPTIONS
    // ═════════════════════════════════════════════════════════════
    match /pushSubscriptions/{token} {
      // Writes: anyone (anonymous public) but only their own token doc.
      // Enforced by doc ID matching; App Check verifies real browser.
      allow read: if false;     // Only Cloud Functions read.
      allow create: if incomingHasFields(['token', 'deviceId', 'matchIds', 'createdAt'])
        && request.resource.data.token == token
        && request.resource.data.matchIds is list
        && request.resource.data.matchIds.size() <= 20;
      allow update: if resource.data.token == token
        && onlyChangedFields(['matchIds', 'subscribedToBroadcasts', 'lastSeenAt'])
        && (request.resource.data.matchIds is list && request.resource.data.matchIds.size() <= 20);
      allow delete: if false;   // Cleanup by Cloud Function only.
    }

    // ═════════════════════════════════════════════════════════════
    // UPLOAD ATTEMPTS (rate limiting)
    // ═════════════════════════════════════════════════════════════
    match /uploadAttempts/{ipHash} {
      allow read, write: if false;   // Cloud Functions only.
    }

    // ═════════════════════════════════════════════════════════════
    // ADMIN EMAILS (bootstrap seed)
    // ═════════════════════════════════════════════════════════════
    match /adminEmails/{id} {
      allow read, write: if isAdmin();
    }

    // ═════════════════════════════════════════════════════════════
    // DEFAULT DENY
    // ═════════════════════════════════════════════════════════════
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 4. Storage rules (`storage.rules`)

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isSignedIn() { return request.auth != null; }
    function isReporter() {
      return isSignedIn() && (request.auth.token.reporter == true || request.auth.token.admin == true);
    }
    function isAdmin() {
      return isSignedIn() && request.auth.token.admin == true;
    }

    // ─── Pending uploads: public can write, limited ──────────────
    match /uploads/pending/{photoId}/{fileName} {
      // Public can write only with App Check + size limits
      allow create: if request.auth == null || isSignedIn()
        ? (
          request.resource.size < 100 * 1024 * 1024  // 100MB hard cap
          && request.resource.contentType.matches('image/.*|video/.*')
        )
        : false;

      // Read: only admin (for moderation)
      allow read: if isAdmin();

      // Update/delete: admin only (or Cloud Functions)
      allow update, delete: if isAdmin();
    }

    // ─── Approved uploads: public read ───────────────────────────
    match /uploads/approved/{photoId}/{fileName} {
      allow read: if true;             // public
      allow write: if false;           // Cloud Functions only (via admin SDK)
    }

    // ─── Rejected uploads: no public access ──────────────────────
    match /uploads/rejected/{photoId}/{fileName} {
      allow read: if isAdmin();
      allow write: if false;
    }

    // ─── Team logos: reporter write, public read ─────────────────
    match /team-logos/{teamId}.{ext} {
      allow read: if true;
      allow write: if isReporter()
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/(png|jpeg|svg\\+xml|webp)');
      allow delete: if isAdmin();
    }

    // ─── Player photos: reporter write, public read ──────────────
    match /player-photos/{playerId}.{ext} {
      allow read: if true;
      allow write: if isReporter()
        && request.resource.size < 3 * 1024 * 1024
        && request.resource.contentType.matches('image/(png|jpeg|webp)');
      allow delete: if isAdmin();
    }

    // ─── Sponsor logos: admin only ───────────────────────────────
    match /sponsor-logos/{sponsorId}.{ext} {
      allow read: if true;
      allow write, delete: if isAdmin();
    }

    // ─── OG cards: Cloud Functions only, public read ─────────────
    match /og-cards/{matchId}.png {
      allow read: if true;
      allow write: if false;   // Admin SDK from Functions
    }

    // ─── Tournament assets (hero images, banners) ────────────────
    match /tournament-assets/{tournamentId}/{fileName} {
      allow read: if true;
      allow write, delete: if isAdmin();
    }

    // ─── Default deny ────────────────────────────────────────────
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 5. Rate limiting (Cloud Function side)

Photo rate-limit is enforced in the `createPhotoRecord` Cloud Function, not in rules alone — rules can't do time-based state easily.

```ts
// functions/src/photos/createPhotoRecord.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';

const MAX_UPLOADS_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

export const createPhotoRecord = onCall(
  { enforceAppCheck: true, cors: true },
  async (req) => {
    const ip = req.rawRequest.ip ?? 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex');

    const db = getFirestore();
    const attemptRef = db.doc(`uploadAttempts/${ipHash}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(attemptRef);
      const now = Date.now();
      if (!snap.exists) {
        tx.set(attemptRef, { ipHash, firstAttemptAt: new Date(now), count: 1, blocked: false });
        return;
      }
      const data = snap.data()!;
      if (data.blocked) throw new HttpsError('permission-denied', 'Blokiran IP.');

      const windowStart = data.firstAttemptAt.toMillis();
      if (now - windowStart > WINDOW_MS) {
        // New window
        tx.update(attemptRef, { firstAttemptAt: new Date(now), count: 1 });
      } else if (data.count >= MAX_UPLOADS_PER_HOUR) {
        throw new HttpsError('resource-exhausted', 'Previše uploadova. Pokušajte kasnije.');
      } else {
        tx.update(attemptRef, { count: FieldValue.increment(1) });
      }
    });

    // Passed rate limit — create photo doc with status 'pending'.
    // (validation of payload omitted here for brevity)
    // ... see functions/src/photos/createPhotoRecord.ts for full impl
  }
);
```

---

## 6. Custom claims management

Custom claims are set by Cloud Functions only, never by the client.

```ts
// functions/src/auth/onUserCreate.ts
import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const onUserCreate = beforeUserCreated(async (event) => {
  const email = event.data?.email;
  if (!email) throw new HttpsError('permission-denied', 'Email required');

  const db = getFirestore();

  // Check admin bootstrap list
  const adminSnap = await db.collection('adminEmails').where('email', '==', email).get();
  if (!adminSnap.empty) {
    await getAuth().setCustomUserClaims(event.data!.uid, { admin: true });
    return;
  }

  // Check invites
  const inviteSnap = await db.collection('invites')
    .where('email', '==', email)
    .where('revoked', '==', false)
    .where('consumedAt', '==', null)
    .limit(1)
    .get();

  if (inviteSnap.empty) {
    throw new HttpsError('permission-denied', 'Nemate pozivnicu.');
  }

  const invite = inviteSnap.docs[0];
  const role = invite.data().role;  // 'reporter' or 'admin'
  await getAuth().setCustomUserClaims(event.data!.uid, { [role]: true });
  await invite.ref.update({ consumedAt: new Date(), consumedByUid: event.data!.uid });
});
```

### Role changes

```ts
// functions/src/users/setRole.ts — callable by admin only
export const setRole = onCall({ enforceAppCheck: true }, async (req) => {
  if (!req.auth?.token.admin) throw new HttpsError('permission-denied', 'Admin only');
  const { uid, role } = req.data as { uid: string; role: 'reporter' | 'admin' | null };

  const claims = role ? { [role]: true } : {};
  await getAuth().setCustomUserClaims(uid, claims);
  // User must refresh token / re-login for this to take effect.
});
```

---

## 7. Testing rules

Use the Firebase Emulator Suite + `@firebase/rules-unit-testing`.

`src/lib/firestore/__tests__/rules.test.ts` scenarios to cover:
- Anonymous can read approved photos, cannot read pending.
- Anonymous cannot write anything except `pushSubscriptions` (own token) and fan votes (with matching deviceId).
- Reporter can create a match event, cannot hard-delete it, cannot toggle lockedForEdit.
- Reporter cannot update a locked match.
- Admin can do everything in their tournament scope.
- Two users with same email → second signup fails.
- Duplicate fan vote from same deviceId fails.
- Push subscription write with a different token in body fails.

Run in CI before every deploy:
```bash
npm run test:rules
```

---

## 8. App Check

- Enable Firebase App Check with reCAPTCHA v3 provider.
- Attach to Firestore, Storage, Functions.
- Callable functions set `enforceAppCheck: true`.
- In development, use debug tokens (disabled in production build via env flag).

App Check blocks automated bots and scripts from hitting the backend, which matters for:
- Anonymous photo uploads
- Fan voting
- Push subscription creation

---

## 9. What rules CANNOT enforce (reminder)

- Time-based rate limits (count in last hour). → Enforced in Cloud Functions.
- Content policy (is this photo OK?). → Enforced by admin moderation.
- Cross-document invariants beyond one `get()`. → Enforced in Cloud Functions or by model design (append-only events).
- Schema changes over time. → Use versioned converters in client; rules stay permissive on shape.
