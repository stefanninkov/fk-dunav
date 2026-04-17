# SPEC.md — FK Dunav Tournament App Feature Specification

## 1. Product summary

A tournament management platform built for FK Dunav Ostrovo's annual small-sided football tournament. One active tournament at a time, historical editions preserved as read-only archives. The public browses groups, schedule, live results, statistics, and gallery. A small team of trusted reporters updates matches live from phones pitchside. The owner (Stefan) approves photo/video uploads submitted openly by anyone.

---

## 2. User roles

| Role | Who | How granted | Capabilities |
|---|---|---|---|
| **Anonymous (public)** | Any visitor | No auth | Read everything public. Upload photos/videos (rate-limited, pending approval). Subscribe to push notifications for specific matches. Vote in fan MVP / best goal polls (1 vote per device). |
| **Reporter** | 2–5 invited people | Invite link + email magic link sign-in, then `reporter` custom claim set by admin | Everything in Public + update matches (score, events, clock), add/edit players, moderate their own uploads. Cannot create tournaments, cannot approve others' photos, cannot change tournament config. |
| **Admin** | Stefan (initially sole admin) | Custom claim `admin` set manually via Firebase console for the first admin; subsequent admins promoted via dashboard | Everything in Reporter + create/configure tournaments, manage all teams/players, approve/reject photos, manage sponsors/announcements/champions history, promote reporters, archive tournaments. |

---

## 3. Public site — pages and features

### 3.1 Home (`/`)
- Hero: tournament title, date, location, countdown to kickoff (if tournament is upcoming) or "LIVE" indicator with list of matches currently in progress.
- Quick stats: teams, players, matches played, goals scored so far.
- Featured live match card (if any live).
- Latest 6 approved photos strip.
- Latest 3 announcements.
- Sponsors ticker (horizontal infinite scroll).
- Links to all main sections.

### 3.2 Groups (`/grupe`)
- All group standings for the current tournament, sorted by points (H2H → GD → GF tiebreakers).
- Columns: position, team name + logo, games played, W–D–L, GF:GA, GD, points.
- Each team name links to its team page.
- Visual indicator on top N qualifying for knockout (configurable, default: top 2 per group).

### 3.3 Schedule (`/raspored`)
- Grouped by day, then by field (Teren 1, Teren 2).
- Each match row: time, teams, score (if played), status badge (scheduled / live / finished).
- Filter: by team, by day, by field.
- Clicking a match opens match detail.

### 3.4 Results (`/rezultati`)
- Group stage results (all finished group-phase matches, chronological).
- Knockout results (all finished knockout matches, separate section).
- Matches are clickable → match detail.

### 3.5 Live (`/uzivo`)
- All currently live matches in large cards: teams, live score, current minute, latest event.
- Card updates in realtime (Firestore listener).
- Score change animates + plays subtle sound ping for goals (user can mute).
- If no matches are live, show upcoming match countdown + recently finished.

### 3.6 Match detail (`/utakmica/{matchId}`)
- Teams + score + status.
- **If live:** full timeline (minute-by-minute events, scorers, cards, subs, shootout if applicable).
- **If finished:** summary (final score, scorers list, cards list, attendance if tracked, shootout result if any).
- **If scheduled:** H2H history (if teams have prior matches in this tournament), lineups (if entered).
- Share button → generates WhatsApp/Instagram link with auto-generated OG card.
- Follow button → push notification subscription for this match.
- Gallery strip (photos tagged to this match).

### 3.7 Knockout bracket (`/nokaut`)
- Visual bracket tree, Champions League style, responsive (scrolls horizontally on mobile if needed).
- Each bracket node shows: teams, score, penalty shootout score if applicable, status.
- Clicking a node → match detail.
- Auto-populates from group standings once group stage completes; admin can override seeding.

### 3.8 Statistics (`/statistika`)
- **Top scorers** (auto-computed from match events): name, team, goals. Top 10 visible, expandable to full list.
- **Discipline:** yellow cards and red cards per player.
- **Kup Šanka** (beer cup leaderboard): team + number of bokala.
- **Crossbar competition (BOSONOGI):** qualifiers list + final bracket.
- **Team of the tournament / player awards** (admin-curated, published at end).
- **Fan voting:** MVP of tournament + best goal (opens after finals, closes a week later).

### 3.9 Gallery (`/galerija`)
- Grid of approved photos and videos.
- Filters: by match, by team, by day, photos only / videos only.
- Lightbox on click with keyboard nav.
- Videos play inline with native controls.
- Upload button → opens upload modal (no login required, with rate limit warning).

### 3.10 Teams (`/timovi`)
- List of all participating teams with logos.
- Each team links to `/tim/{teamId}`:
  - Logo, name, group.
  - Roster (players with photos).
  - Matches played with results.
  - Stats: goals for/against, top scorers, card count.

### 3.11 Players (`/igrac/{playerId}`)
- Name, photo, team.
- Stats in current tournament: goals, assists, yellow cards, red cards, matches played.
- List of events this player was involved in.

### 3.12 Sponsors (`/sponzori`)
- Grid of sponsor logos with optional link, tier (gold/silver/bronze or similar), and thank-you text.
- Prominent banner section for main sponsors.

### 3.13 Rules / Pravilnik (`/pravilnik`)
- Static markdown-rendered page explaining tournament format, rules, tiebreakers, disciplinary procedure.
- Editable by admin via dashboard.

### 3.14 About / Kontakt (`/o-turniru`)
- Organizer info, contact, tournament history summary, photo of organizing committee.
- Editable by admin via dashboard.

### 3.15 Champions history (`/sampioni`)
- Past tournament winners: year, champion team, runner-up, 3rd place, top scorer, MVP.
- One entry per tournament edition. 2025 entry pre-populated from last year.

### 3.16 Archive (`/2025`)
- Static replica of the 2025 Webflow site's data: groups, schedule, results, top scorers, Kup Šanka, gallery.
- Read-only. Links back to current tournament from a banner.

### 3.17 Announcements banner
- Global: when the admin publishes an announcement (e.g., "Utakmica pomerena za 14:30 zbog kiše"), it shows as a dismissible banner on every page.
- Full list of announcements on `/o-turniru` or similar.

---

## 4. Dashboard — pages and features

Dashboard is at `/admin`, protected. All reporters and admins land here after login.

### 4.1 Login (`/admin/login`)
- Email magic link only (no passwords).
- If the email isn't on the invite list, show "nemate pristup" message and contact link.

### 4.2 Dashboard home (`/admin`)
- Active tournament summary.
- Live matches (if any) — quick link to update.
- Pending photo uploads count (badge) — link to moderation queue.
- Today's schedule (matches assigned to this reporter's fields if applicable).
- Recent activity feed (who updated what).

### 4.3 Matches (`/admin/utakmice`)
- List of all matches in the active tournament.
- Filter by status (scheduled / live / finished), day, field, group.
- Click a match → match editor.

### 4.4 Match editor (`/admin/utakmice/{id}`)
The core reporter workflow. Must be rock-solid on mobile.

- **Pre-match:** set lineups (optional), confirm start time.
- **Starting the match:** "Počni utakmicu" button → status = live, clock starts at 00:00, first-half timer running.
- **During match:**
  - Score displayed large, `+` button next to each team to record a goal.
  - Goal modal: pick scorer (searchable player list of that team), pick assist (optional, searchable same team), edit minute (prefilled from current clock), save.
  - Cards: buttons for yellow, red. Modal: pick player, edit minute, save.
  - Substitution (if enabled): pick off, pick on, edit minute, save.
  - Clock controls: pause, resume, end first half, start second half, end match.
  - Timeline of events, each editable until match is finalized.
- **Ending match:** "Završi utakmicu" → status = finished, locks the clock, prompts for MOTM (optional), shootout if tied in knockout.
- **Shootout modal (knockout only, if tied):** alternating A/B kicks, mark scored/missed, final tally auto-computed, winner recorded.
- **Post-match:** summary visible, events editable only by admin (reporters can request a fix).

**Offline-first:** all writes queue locally if offline, sync automatically on reconnect. A prominent banner shows offline status.

### 4.5 Teams (`/admin/timovi`)
- List of all teams in active tournament.
- Add team: name, logo upload (optional), group assignment.
- Edit team: same fields + roster management.
- Delete team: only if no matches yet scheduled.

### 4.6 Players (`/admin/igraci`)
- List of all players across all teams, filterable by team.
- Add player: name, surname, team, photo (optional).
- Edit, delete (soft — mark as inactive).
- Bulk import by CSV (future, not MVP).

### 4.7 Schedule editor (`/admin/raspored`)
- Calendar-like view by day + field.
- Add match: teams, day, field, time, group assignment (or knockout round).
- Edit match time/field before it starts.
- Reschedule (publishes an announcement automatically? — confirm with Stefan later).

### 4.8 Bracket editor (`/admin/bracket`)
- Visual tree. Admin seeds the initial round (quarters typically).
- Supports any bracket size (4, 8, 16 teams).
- Winners auto-advance as matches are finalized.

### 4.9 Photo moderation (`/admin/galerija`)
- Tabs: Pending / Approved / Rejected.
- Pending queue: grid of thumbnails with uploader info (IP, rough location if available, upload time).
- Actions: Approve / Reject / Tag (match, team, day). Bulk select.
- Rejected items retained for 7 days then purged.
- Email notification to Stefan on new upload (batched hourly, not per-upload to avoid spam).

### 4.10 Announcements (`/admin/obavestenja`)
- List, create, edit, delete announcements.
- Fields: title, body (short, max 280 chars), severity (info / warning / urgent), expiry datetime.
- Urgent announcements also trigger a push notification.

### 4.11 Sponsors (`/admin/sponzori`)
- CRUD sponsors: name, logo, link, tier, display order.

### 4.12 Side competitions
- **Kup Šanka (`/admin/kup-sanka`):** list of teams with editable "bokala" count. Sorted leaderboard.
- **Crossbar (`/admin/precka`):** qualifying list, final bracket, winner recording.
- **Awards (`/admin/nagrade`):** MVP, Team of the Tournament, champions, runners-up. Set at end of tournament.

### 4.13 Tournament settings (`/admin/turnir`)
- Active tournament config: name, dates, fields (names), match time format (halves × minutes), knockout qualifiers per group, tiebreaker order (locked to current choice for 2026).
- "Archive tournament" button: locks all data, makes tournament read-only, creates new tournament as draft.

### 4.14 Users & roles (`/admin/korisnici`) — admin only
- List of all users with reporter or admin claim.
- Invite new reporter: email → sends magic-link invite, sets claim on first login.
- Remove claim.
- Promote reporter to admin (requires second admin confirmation — two-admin rule; skippable if Stefan is the only admin).

### 4.15 Fan voting management (`/admin/glasanje`) — admin only
- Open/close MVP and best-goal polls.
- Manually curate candidate list for each.
- Results table with vote counts.

### 4.16 History & 2025 archive (`/admin/sampioni`)
- CRUD champions history entries.
- 2025 archive page content (editable markdown for the `/2025` route).

---

## 5. Authentication flow

1. Reporter/admin visits `/admin/login`.
2. Enters email.
3. If email is in invite list (admin pre-populates), a Firebase Auth magic link is sent.
4. Link opens and signs the user in.
5. If this is a first-time reporter, a Cloud Function sets the `reporter` custom claim.
6. Token refreshes, app routes to `/admin`.
7. Session persists 30 days; re-auth required after that.

Admin bootstrap: Stefan's email is added manually to `/admin-emails` Firestore doc; Cloud Function on first login promotes him to `admin` claim.

---

## 6. Photo moderation flow

1. Anonymous visitor clicks "Uploaduj fotke" in gallery.
2. Upload modal: file picker (photos/videos), optional tags (match, team, day), uploader's name (optional, for credit).
3. Client-side: validate file type + size (max 10 MB image, 100 MB video, max 5 files per upload, rate-limited at 5 uploads per IP per hour).
4. File → Firebase Storage at `/uploads/pending/{uuid}.{ext}`, metadata includes IP, user agent, upload time, tags.
5. Cloud Function on upload:
   - Creates `/tournaments/{id}/photos/{photoId}` Firestore doc with status `pending`.
   - Triggers image resize (thumbnail 400px, medium 1200px, full original).
   - Adds to batched email to Stefan (hourly digest).
6. Stefan opens `/admin/galerija`, sees pending queue, approves/rejects.
7. Approval sets status `approved`, photo becomes visible in public gallery instantly (Firestore listener).
8. Rejection sets status `rejected`, keeps file for 7 days then Cloud Function purges.

Rate limiting enforced via Cloud Function with App Check token + IP tracking in `/uploadAttempts/{ip}` doc.

---

## 7. Live match flow (the critical path)

The reporter's experience is the highest-priority UX in the app.

1. Reporter opens match editor on their phone.
2. Pre-match: confirms teams, sets lineups (optional).
3. Taps "Počni utakmicu". Clock starts, status = live, timestamp recorded.
4. A goal happens: taps `+` next to the scoring team. Modal opens with big search input, reporter types 3 letters of scorer's name, picks. Optional assist. Minute is prefilled from clock, editable. Save.
5. Write goes to Firestore (or offline queue if disconnected).
6. Public viewers on `/utakmica/{id}` see score animate + hear ping. Push notification fires to followers.
7. Card: same flow, different modal.
8. Reporter pauses clock at halftime, resumes at second-half start.
9. Final whistle: taps "Završi utakmicu". Confirmation modal (prevents accidental end). If tied in knockout, prompts for shootout.
10. Shootout: alternating A/B, tap scored/missed. Auto-ends when outcome decided.
11. Match finalized, MOTM optional prompt, summary visible publicly.

**Key offline behavior:** all events are appends to a subcollection. No mutations means no conflicts. Events carry a `clientEventId` (UUID) for idempotency, a `loggedAt` (reporter's local time), and a `minute` (gameplay time). Server adds `serverTimestamp` on sync. If two reporters somehow log the same goal, admin can remove duplicates in the editor.

---

## 8. Push notification logic

Subscriber flow:
1. Public user on match detail page taps "Prati ovaj meč".
2. Browser asks for notification permission.
3. On grant, FCM token + match ID written to `/pushSubscriptions/{token}` with `matchIds: [...]`.
4. User can manage subscriptions in a "Moji mečevi" drawer (client-side only, no login).

Trigger flow:
1. Event written to `/tournaments/{id}/matches/{mid}/events/{eid}` (goal, final whistle).
2. Cloud Function `onEventCreate` triggers.
3. Function filters event type: only `matchStart`, `goal`, `matchEnd` trigger push.
4. Function queries `/pushSubscriptions` where `matchIds` contains `mid`.
5. Sends FCM multicast: title = "GOL! {teamName} {score}", body = "{scorerName} — {minute}'".
6. Failed tokens pruned from Firestore.

iOS caveat: web push requires PWA install on iOS 16.4+. When on iOS Safari, show a "Dodaj na početni ekran" prompt before the subscribe button, with brief instructions.

---

## 9. Tournament lifecycle

1. Admin creates tournament in draft mode: sets name, dates, fields, match time format.
2. Admin adds teams, assigns to groups, adds players.
3. Admin enters schedule (matches).
4. Admin sets tournament to `active` (previously active tournament auto-archives).
5. Reporters update matches as they happen.
6. Stefan approves photos in real time.
7. Group stage finishes → admin seeds knockout bracket.
8. Knockout plays out → finals.
9. Admin records awards (champions, MVP, top scorer, team of the tournament).
10. Admin archives tournament → becomes read-only, visible under `/sampioni` and a link under `/turniri` (or similar listing).

---

## 10. Edge cases & business rules

- **Postponed match:** admin changes match time/field in schedule editor; publishes announcement; all listeners update.
- **Abandoned match:** admin marks match as `abandoned` with reason; counts as 0–0 for standings unless overridden.
- **Player on two teams:** forbidden — data model enforces 1:1 team ↔ player relation per tournament.
- **Tied in group stage:** standings auto-apply H2H → GD → GF. Ties beyond that fall to alphabetical with a warning flag for admin to manually override.
- **Tied in knockout (draw at end of regular time):** mandatory shootout, no extra time. Dashboard enforces this flow.
- **Photo of someone's face, they want it removed:** admin marks as `rejected` post-approval; photo is removed from gallery; file retained 30 days for dispute, then purged.
- **Reporter makes a mistake after a match is finished:** reporter opens match, sees events read-only, taps "Zatraži izmenu" which pings admin; admin can unlock and fix.
- **Announcement created mid-match:** banner appears on public site immediately; if marked urgent, push fires to all subscribers (broadcast, not match-specific).
- **Sponsor logo upload:** admin-only, bypasses moderation queue.

---

## 11. Out of scope (for June 2026 deadline)

- Auto-generated fixtures (round-robin algorithm).
- CSV bulk import of players.
- Tournament predictions / fantasy picks.
- Live chat / match commentary text.
- Live video stream embed (keep as future enhancement — placeholder UI only).
- Merchandise / ticketing.
- Multi-language (only Latin Serbian for 2026).
- Native apps (iOS/Android store). Web + PWA only.
- Tournament duplication ("copy last year's schedule with new teams" — do manually in 2026, build in 2027 if needed).
- CSV/PDF export (confirmed not needed).
