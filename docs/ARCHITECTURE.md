# ARCHITECTURE.md — Technical Architecture

This document covers the how. For the what, see `SPEC.md`. For data shape, see `DATA-MODEL.md`.

---

## 1. High-level overview

```
┌──────────────────────────┐        ┌───────────────────────────┐
│  Public Site (SPA)       │        │  Dashboard (same SPA)     │
│  /                       │        │  /admin                   │
│  /grupe, /raspored, ...  │        │  /admin/utakmice, ...     │
│  Anonymous reads         │        │  Auth required            │
└───────┬──────────────────┘        └───────────┬───────────────┘
        │                                       │
        │           React Router v7             │
        └─────────────────┬─────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Zustand stores      │
              │   (UI state, caches)  │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────────────────────┐
              │   Firebase SDK (client)               │
              │   - Firestore (realtime + offline)    │
              │   - Auth (magic link)                 │
              │   - Storage (upload/download)         │
              │   - FCM (push subscribe)              │
              │   - App Check (anti-abuse)            │
              └────────────┬──────────────────────────┘
                           │
          ┌────────────────┼────────────────────────────┐
          │                │                            │
          ▼                ▼                            ▼
   ┌────────────┐   ┌──────────────┐           ┌─────────────────┐
   │ Firestore  │   │ Cloud        │           │ Cloud           │
   │ (source of │◄──┤ Functions    │──────────►│ Storage         │
   │ truth)     │   │              │           │                 │
   └────────────┘   │ - onEvent    │           └─────────────────┘
                    │ - onPhoto    │
                    │ - onMatch    │                   ▲
                    │ - FCM send   │                   │
                    │ - OG card    │                   │
                    │ - rate limit │   ┌───────────────┘
                    │ - image      │   │
                    │   resize     │   │
                    └──────┬───────┘   │
                           │           │
                           ▼           │
                  ┌────────────────────┴─┐
                  │ Firebase Extensions  │
                  │ - Resize Images      │
                  │ - Trigger Email      │
                  └──────────────────────┘
```

---

## 2. Routing

Using React Router v7 (Data Router mode).

### Public routes
```
/                        → Home
/grupe                   → Groups & standings
/raspored                → Schedule
/rezultati               → Results
/uzivo                   → Live matches
/utakmica/:matchId       → Match detail
/nokaut                  → Knockout bracket
/statistika              → Stats
/galerija                → Gallery
/timovi                  → Teams list
/tim/:teamId             → Team detail
/igrac/:playerId         → Player detail
/sponzori                → Sponsors
/pravilnik               → Rules
/o-turniru               → About
/sampioni                → Champions history
/2025                    → Archive of 2025 edition
```

### Admin routes (auth required)
```
/admin                           → Dashboard home
/admin/login                     → Login (magic link)
/admin/utakmice                  → Matches list
/admin/utakmice/:matchId         → Match editor
/admin/timovi                    → Teams management
/admin/igraci                    → Players management
/admin/raspored                  → Schedule editor
/admin/bracket                   → Bracket editor
/admin/galerija                  → Photo moderation
/admin/obavestenja               → Announcements
/admin/sponzori                  → Sponsors
/admin/kup-sanka                 → Beer cup leaderboard
/admin/precka                    → Crossbar competition
/admin/nagrade                   → Awards
/admin/turnir                    → Tournament settings
/admin/korisnici                 → Users & roles (admin only)
/admin/glasanje                  → Fan voting (admin only)
/admin/sampioni                  → Champions history editor
```

### Route guards

- All `/admin/*` routes (except `/admin/login`): require authenticated user.
- `/admin/korisnici`, `/admin/glasanje`, `/admin/turnir` (destructive ops), `/admin/sampioni`: require `admin` claim.
- All others in `/admin`: require `reporter` or `admin` claim.

Implement via a `<ProtectedRoute requiredClaim="reporter" />` wrapper. Claims read from `auth.currentUser.getIdTokenResult()` and cached in a Zustand auth store.

---

## 3. Authentication

### Email magic link (passwordless)

Why: no passwords for reporters to forget, no reset flow, lowest support burden.

Flow:
1. User enters email on `/admin/login`.
2. Client calls `sendSignInLinkToEmail(auth, email, { url: 'https://site/admin/finish-signin', handleCodeInApp: true })`.
3. Email address stored in `localStorage` as `emailForSignIn` (per Firebase docs).
4. User opens email, clicks link → lands on `/admin/finish-signin?apiKey=...&oobCode=...`.
5. Client checks `isSignInWithEmailLink(auth, window.location.href)`, calls `signInWithEmailLink`.
6. Redirects to `/admin`.
7. A Cloud Function `onUserCreate` (Auth trigger) checks if the email exists in `/invites/{id}`:
   - If yes, sets the appropriate custom claim (`reporter` or `admin`), marks invite consumed.
   - If no, signs the user out and deletes their Auth record.
8. Client reads ID token, extracts claims, routes accordingly.

### Invite system

- Admin opens `/admin/korisnici`, adds email + role.
- Creates `/invites/{id}` doc.
- Admin clicks "Pošalji pozivnicu" button → magic link generated via `sendSignInLinkToEmail` with email template hinting at "FK Dunav admin panel".
- On user's first login, claim is set by `onUserCreate` function; invite marked consumed.

### Claim refresh

Custom claims require a token refresh to take effect. After an admin promotes a user, the target user must log out and back in. The dashboard shows a warning "Osveži login" after role changes.

### Session persistence

Use `browserLocalPersistence`. Token auto-refreshes every hour. After 30 days of inactivity, Firebase Auth re-auths automatically.

---

## 4. Offline-first strategy

### Firestore offline persistence

Enable with `enableMultiTabIndexedDbPersistence(db)` on app init. Caches reads, queues writes.

```ts
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

This gives us:
- Reads hit cache first, then sync in background.
- Writes queue and fire when connection returns.
- Listeners fire from cache then update when server responds.

### Append-only event model

The critical insight: match events are **never mutated**, only appended. When a reporter logs a goal offline, it's a new document create. When connection returns, it syncs. Two reporters cannot create conflicting events because each event has a unique `clientEventId` (client-generated UUID).

If two reporters accidentally log the same goal, admin sees duplicates in the match timeline and soft-deletes one.

### Match score & clock

- `match.score` is recomputed server-side by a Cloud Function listening to `onEventWrite`. It's a cache; if it drifts, the function re-aggregates from events.
- `match.clock` state is written by the reporter client with `serverTimestamp()` for `halfStartedAt`. If a reporter updates the clock offline, their local `halfStartedAt` is stale — but `displayMinute` is a client-computed derivative of the clock state, so visitors see the reporter's last-known minute until sync completes.
- If a reporter is offline for an extended period, they can manually override any event's `minute` field to match reality.

### UI indicators

- Top banner: "Oflajn — promene će se sinhronizovati kad se vratite" when `!navigator.onLine`.
- Per-event icon: "⟳" pending-sync icon on events whose `serverTimestamp` is still null (optimistic local writes).
- Auto-dismiss banner on reconnect, show brief "Sinhronizovano" toast.

Use `navigator.onLine` + `window.addEventListener('online'/'offline')` for UI state. Firestore handles the actual sync.

### What doesn't work offline

- Photo uploads require connection (Storage doesn't queue writes locally in web SDK). Show "Upload zahteva internet" when offline.
- Push notification subscription needs online for FCM token generation.
- Auth (magic link) needs online.

---

## 5. Realtime listeners

### Public site listeners

- **Home:** one listener on active tournament + one on currently-live matches + one on latest 3 announcements + one on top 6 photos. Unsubscribe on unmount.
- **Live page:** listener on `matches where status == 'live'`.
- **Match detail (live):** listener on match doc + listener on events subcollection. On unmount both unsubscribe.
- **Gallery:** listener on approved photos with pagination (query limit 30, load more on scroll).

### Dashboard listeners

- **Match editor:** listener on match doc + events. Exclusive to this editor; unsubscribe on navigate away.
- **Photo moderation:** listener on `photos where status == 'pending'` (typically small set).

### Subscription hygiene

Every `onSnapshot` call must:
- Return its unsubscribe function from the `useEffect`.
- Be wrapped in a custom hook to centralize the pattern.

Example hook pattern:
```ts
function useMatch(matchId: string) {
  const [match, setMatch] = useState<Match | null>(null);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tournaments', activeTournamentId, 'matches', matchId), (snap) => {
      setMatch(snap.exists() ? matchConverter.fromFirestore(snap) : null);
    });
    return unsub;
  }, [matchId]);
  return match;
}
```

---

## 6. State management (Zustand)

One store per concern:

- `useAuthStore` — current user, claims, loading state.
- `useTournamentStore` — active tournament ID, tournament config.
- `useOfflineStore` — `isOnline`, `pendingWrites` count.
- `useUIStore` — sidebar open, sound-muted, reduce-motion, theme.
- `usePushStore` — FCM token, subscribed match IDs.

Listeners write directly to local component state OR to stores if the data is cross-cutting (e.g., active tournament). Keep stores small and focused; don't turn Zustand into Redux.

---

## 7. Push notifications (FCM web)

### Setup

1. Add Firebase messaging service worker at `/public/firebase-messaging-sw.js`.
2. On user tap of "Prati ovaj meč":
   - Check `Notification.permission`. If `default`, call `Notification.requestPermission()`.
   - If granted, call `getToken(messaging, { vapidKey })`.
   - Write token to `/pushSubscriptions/{token}` with the match ID in `matchIds` array (using `arrayUnion`).
3. On iOS (detect via `navigator.standalone` + user agent), show an install prompt first: "Dodaj na početni ekran za obaveštenja".

### Sending (Cloud Function)

```ts
// functions/src/push/onMatchEvent.ts
export const onMatchEvent = functions.firestore
  .document('tournaments/{tid}/matches/{mid}/events/{eid}')
  .onCreate(async (snap, context) => {
    const event = snap.data();
    const trigger = ['matchStart', 'goal', 'matchEnd'].includes(event.type);
    if (!trigger) return;

    const subs = await db.collection('pushSubscriptions')
      .where('matchIds', 'array-contains', context.params.mid)
      .where('invalid', '==', false)
      .get();

    const tokens = subs.docs.map(d => d.id);
    if (!tokens.length) return;

    const payload = buildEventPayload(event); // { notification: { title, body }, data: { matchId } }
    const response = await messaging.sendEachForMulticast({ tokens, ...payload });

    // Prune invalid tokens
    await Promise.all(
      response.responses.map((r, i) => {
        if (r.error && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error.code)) {
          return db.doc(`pushSubscriptions/${tokens[i]}`).update({ invalid: true });
        }
      }),
    );
  });
```

### Broadcast push (urgent announcements)

Similar, but queries `pushSubscriptions` where `subscribedToBroadcasts == true` and sends to all. Admin confirms before sending to avoid noise.

---

## 8. Image & video upload pipeline

### Client upload

1. User picks files from `<input type="file" accept="image/*,video/*">`.
2. Client validates:
   - File count ≤ 5 per upload.
   - Image ≤ 10 MB. Video ≤ 100 MB and ≤ 60 seconds (read duration via `<video>` element before upload).
3. For each file:
   - Generate UUID `photoId`.
   - Upload to `/uploads/pending/{photoId}/original.{ext}` via `uploadBytesResumable`.
   - On completion, call Cloud Function `createPhotoRecord` via HTTPS callable with metadata (tags, uploaderName, mimetype, size).

### Rate limiting

- App Check (reCAPTCHA v3) verifies every call, rejects bots.
- `createPhotoRecord` Cloud Function:
  1. Hashes client IP (via `context.rawRequest.ip`) to `ipHash`.
  2. Reads `/uploadAttempts/{ipHash}`. If `count >= 5` and `firstAttemptAt` within last hour, reject with `permission-denied`.
  3. Otherwise increments count or resets window.
  4. Creates `/tournaments/{id}/photos/{photoId}` doc with status `pending`.
  5. Appends to batched email digest (see below).

### Server-side processing

- **Firebase Extension: Resize Images** configured to watch `/uploads/pending/*/original.*` and produce `thumbnail.jpg` (400px) and `medium.jpg` (1200px) in the same folder.
- On resize complete (function trigger), updates `photo.thumbnailUrl` and `photo.mediumUrl`.

### Moderation email digest

- `onPhotoCreate` Cloud Function appends pending photo ID to `/notificationsQueue/photoDigest` doc.
- Scheduled function every hour collects the queue, sends a single email to Stefan via Firebase Extension `Trigger Email` or SendGrid, includes thumbnails and approve links that deep-link to `/admin/galerija`.
- Queue cleared after send.

### Approval

- Admin clicks Approve on `/admin/galerija`.
- Client calls Cloud Function `approvePhoto(photoId)`.
- Function:
  1. Moves files from `/uploads/pending/{photoId}/` to `/uploads/approved/{photoId}/`.
  2. Updates photo doc: `status = 'approved'`, `reviewedBy`, `reviewedAt`, updates storage URLs.
  3. Public listener picks it up instantly.

### Rejection

- Marks photo `rejected`. Files remain in `/uploads/pending/` initially.
- Scheduled daily function purges `rejected` photos older than 7 days.

### Takedown (post-approval)

- Admin clicks "Ukloni" on an approved photo.
- Function moves file to `/uploads/rejected/`, sets `status = 'rejected'`, `takedownRequested = true`.
- Files retained 30 days for dispute, then purged by same scheduled function.

---

## 9. OG social cards (per-match)

### Generation

- Cloud Function `generateOgCard(matchId)` renders a PNG:
  - Uses `@vercel/og` or `node-canvas` in a function.
  - Template: 1200×630 with FK Dunav blue background, logo, match title "KLIČEVAC vs LJUBINJE", score (or "UŽIVO" if live), date, field.
  - Writes to `/og-cards/{matchId}.png`.
- Triggered on match status change to `live` or `finished`, and on score events.
- Throttle: regenerate at most once per 30 seconds per match (to avoid spamming on rapid goals).

### Delivery

**Static hosting limitation:** GitHub Pages can't serve dynamic meta tags per URL. Options:
- **(A) Prerender for bots.** Detect crawler UA via a Cloudflare Worker (if we put CF in front) and serve a prerendered HTML with OG meta for that match.
- **(B) Move to Firebase Hosting or Vercel** when we go to production domain. Use hosting rewrites to serve `/utakmica/:id` through a Cloud Function that injects meta tags server-side.

**Plan:** ship on GitHub Pages with a generic site-wide OG card for initial phases. Switch to Firebase Hosting before tournament kickoff with dynamic meta rewrites. Document the migration as its own task in `ROADMAP.md`.

Alternative: Vercel deployment with an edge function that handles `/utakmica/:id` HTML injection — easy to set up, free tier covers this easily.

---

## 10. Tiebreaker calculation

Implemented in `src/lib/utils/standings.ts` as a pure function called by a Cloud Function on match finalization.

```ts
type TiebreakerRule = 'h2h' | 'gd' | 'gf' | 'ga';

function rankGroup(standings: Standing[], tiebreakerOrder: TiebreakerRule[]): Standing[] {
  return [...standings].sort((a, b) => {
    // Points always first
    if (b.points !== a.points) return b.points - a.points;
    // Then apply configured tiebreakers
    for (const rule of tiebreakerOrder) {
      const diff = compareByRule(a, b, rule, standings);
      if (diff !== 0) return diff;
    }
    return a.teamName.localeCompare(b.teamName, 'sr-Latn');
  });
}
```

`h2h` comparison when multiple teams tied: recursively rank only the tied subset by points in their head-to-head matches only.

Edge case: three-way tie where H2H results are also tied. Fall through to next rule (GD). Document clearly in the function.

---

## 11. Bracket auto-propagation

After group stage completes:
1. Admin clicks "Seed bracket" in `/admin/bracket`.
2. Cloud Function reads `/standings` for each group.
3. Populates bracket slots based on a configurable seeding map (default: A1 vs B2, A2 vs B1, etc., from 2025 format).
4. Creates knockout matches in `/matches` with appropriate `bracketSlot`.
5. After a knockout match finishes, another Function reads the next slot's dependency and populates teams.

Bracket rendering client-side reads matches where `phase == 'knockout'`, groups by round, lays out using a grid or SVG tree.

---

## 12. Hosting & deployment

### Initial: GitHub Pages

- Repo: `stefansaur/fk-dunav-tournament` (or similar).
- `gh-pages` branch hosts built SPA.
- `npm run deploy:gh` runs `vite build` then `gh-pages -d dist`.
- Base path configured in `vite.config.ts` if repo is not user/org root.
- GitHub Actions workflow `.github/workflows/deploy.yml`:
  - Trigger: push to `main`.
  - Steps: checkout, install, test, build, deploy to `gh-pages`.
  - Separate job: `firebase deploy --only functions,firestore:rules,storage:rules,firestore:indexes` on changes to those paths.

### Production: Firebase Hosting (or Vercel)

Before tournament:
- Migrate SPA to Firebase Hosting via `firebase init hosting`.
- Set up rewrites for `/utakmica/:matchId` to a Cloud Function that injects OG meta tags.
- Configure custom domain (Stefan's domain, added later).
- Keep Firebase backend pointing at same project.

Alternative production: Vercel.
- Deploy via `vercel` CLI or GitHub integration.
- Edge Function at `/utakmica/[id].tsx` injects meta tags.
- Better DX for SPA + edge functions, but adds a service to manage.

Decision deferred until Stefan provides the production domain. Default recommendation: Firebase Hosting for tight integration with the rest of the stack.

### Firebase project setup

- One Firebase project: `fk-dunav-tournament` (or `stefan-fk-dunav`).
- Environments:
  - `development` (emulator suite locally).
  - `production` (single shared, no staging for MVP).
- Config files per environment in `.env.local` and `.env.production`.

---

## 13. Error handling & observability

- **Client errors:** wrap all top-level routes in an error boundary that logs to Firebase Crashlytics (web) or Sentry (if we add it).
- **Cloud Function errors:** caught and logged with context; critical errors (push fail rate, auth onCreate fail) trigger an email alert to Stefan.
- **Firestore write failures:** shown as a toast in UI with retry button. Offline queue handles transient failures automatically.
- **Image upload failures:** progress bar, retry button, clear error message in Serbian.

---

## 14. Performance guardrails

- Lazy-load admin routes (React.lazy) — public visitors don't need admin code.
- Lazy-load the match editor inside admin (reporters mostly only use this view).
- Image thumbnails (400px) for gallery grid, medium (1200px) for lightbox.
- Gallery paginated at 30 items, infinite scroll via IntersectionObserver.
- Firestore queries: always paginated. Never unlimited `onSnapshot` on a large collection.
- Bundle budget: initial JS ≤ 250 KB gzipped. Public site LCP ≤ 2.5s on 4G.
- Fonts: self-host (no Google Fonts request) or use `font-display: swap`.

---

## 15. Accessibility

- Semantic HTML throughout. Navigation in `<nav>`, lists as `<ul>`, buttons as `<button>`.
- Focus states always visible. Tailwind's `focus-visible:` utilities.
- Keyboard navigation for lightbox (arrow keys, esc).
- Color contrast WCAG AA minimum (brand blue on white or white on brand blue both pass).
- `prefers-reduced-motion` respected on all GSAP animations.
- Screen reader text for icon-only buttons (`<span className="sr-only">`).
