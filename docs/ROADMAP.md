# ROADMAP.md — 10-Week Build Plan

**Today:** April 17, 2026 (Friday).
**Tournament kickoff:** June 27, 2026 (Saturday) — 10 weeks and 2 days out.
**Reporters must be trained by:** June 20, 2026 — 9 weeks out.
**Soft launch of public site:** June 13, 2026 — 8 weeks out (gives 2 weeks for spectators to discover).

Each week is roughly one milestone. Weeks assume ~25–35 hours/week of focused work. If a week slips, cut scope from side features (Kup Šanka, crossbar, fan voting) first — never cut from core match tracking.

---

## Week 1 — Apr 17–24: Foundation
**Goal:** Project scaffolded, environment working end-to-end, auth flow proven.

- [ ] Create GitHub repo. Initialize with Vite + React + TS + Tailwind v4.
- [ ] Install and configure: Firebase SDK, Zustand, React Router v7, React Hook Form, Zod, Lucide, @fontsource/inter, @fontsource/space-grotesk, GSAP.
- [ ] Set up Firebase project: Firestore, Auth, Storage, Functions, FCM, App Check.
- [ ] Firebase emulators running locally. `npm run dev` + `firebase emulators:start` composition.
- [ ] Tailwind config with all tokens from `DESIGN.md`.
- [ ] Logo imported, favicon generated (all sizes).
- [ ] Firestore rules starter (deny-all fallback) and `firestore.indexes.json`.
- [ ] Zustand `useAuthStore`, `useOfflineStore`, `useUIStore` created (empty shells).
- [ ] `<PublicLayout>` and `<AdminLayout>` skeletons. Bottom nav on mobile for admin.
- [ ] Login page with magic link flow. Admin bootstrap: Stefan's email in `/adminEmails` manually.
- [ ] First successful login end-to-end → lands on empty `/admin`.
- [ ] GitHub Actions workflow: build + lint + typecheck on every push. Deploy to `gh-pages` on `main`.
- [ ] Firebase deploy workflow for functions + rules.

**End of week checkpoint:** Stefan can log into an empty but working dashboard on a custom GitHub Pages URL.

---

## Week 2 — Apr 25–May 1: Data layer
**Goal:** Tournament, teams, players, groups, schedule all CRUD from dashboard. Persistence confirmed.

- [ ] Typed Firestore converters for every entity in `DATA-MODEL.md`.
- [ ] `useActiveTournament` hook + `useTournamentStore`.
- [ ] `/admin/turnir` settings page: create tournament (draft → active).
- [ ] `/admin/timovi` CRUD: name, logo upload to Storage, group assignment.
- [ ] `/admin/igraci` CRUD: name, surname, team, optional photo.
- [ ] Groups management (simple: Grupa A, Grupa B creation, N groups supported).
- [ ] `/admin/raspored` schedule editor: create matches (scheduled) assigning teams, day, time, field, group/phase.
- [ ] Security rules wired for tournament, teams, groups, players, matches (reporter write / admin delete).
- [ ] Seeded fixtures import helper: Stefan enters 2026 teams and schedule by hand (no auto-generation).

**End of week checkpoint:** A complete tournament setup entered in the dashboard, visible in Firestore.

---

## Week 3 — May 2–8: Public site (static parts)
**Goal:** Public site shell reads live data; looks like the finished product for scheduled-only matches.

- [ ] Home page with hero, countdown, quick stats, placeholder for live + gallery + announcements.
- [ ] `/grupe` — group standings table (zero-state when no matches played).
- [ ] `/raspored` — schedule grouped by day + field.
- [ ] `/timovi`, `/tim/:teamId` with roster + matches.
- [ ] `/igrac/:playerId` basic profile.
- [ ] `/o-turniru` and `/pravilnik` markdown-rendered static pages (admin-editable from dashboard — basic markdown textarea is fine, no WYSIWYG).
- [ ] `/sampioni` list with 2025 entry pre-populated.
- [ ] Header / footer final, branded.
- [ ] Light smoke-test on real mobile (Stefan's phone + another device).
- [ ] Serbian UI strings pass from `src/i18n/sr.ts` everywhere — no hardcoded Serbian text in components.

**End of week checkpoint:** Public site feels real, loads scheduled matches, but no match activity yet.

---

## Week 4 — May 9–15: Match editor core (the hardest feature)
**Goal:** Reporter can start a match, log events, end a match, with full offline support.

- [ ] Match editor route `/admin/utakmice/:matchId`.
- [ ] `<MatchEditorHeader>` with teams, current score, clock.
- [ ] Clock component: start / pause / halftime / second-half / end. Persists clock state to Firestore.
- [ ] Score button + `<GoalModal>`: player search, assist, minute edit, save event.
- [ ] `<CardModal>` for yellow / red / second-yellow-as-red.
- [ ] Event timeline display with inline edit (admin) / read-only (reporter past events).
- [ ] "Završi utakmicu" confirmation modal.
- [ ] Firestore offline persistence enabled. Test by airplane-mode on mobile.
- [ ] `<OfflineBadge>` + `<OfflineQueueIndicator>` wired to `useOfflineStore`.
- [ ] Idempotent event creation via `clientEventId` UUID.
- [ ] Security rules: reporter can create events, admin can soft-delete.
- [ ] `match.score` recompute Cloud Function on event create/delete.

**End of week checkpoint:** Stefan and one other person can simulate a match on two phones, log goals, end the match. Works with Wi-Fi off → on.

---

## Week 5 — May 16–22: Live public experience
**Goal:** Visitors see live matches update in real time with animation and sound.

- [ ] `/uzivo` live page listing live matches.
- [ ] `<LiveMatchCard>` with real-time listener.
- [ ] `/utakmica/:matchId` match detail page:
  - Live view with `<MatchTimeline>`, full event log.
  - Finished view with summary.
- [ ] Score animation (GSAP: scale pop + brand-blue glow) on score change, respecting `prefers-reduced-motion`.
- [ ] Goal sound with mute toggle in header, persisted to localStorage.
- [ ] Share button generates WhatsApp/Instagram deep link (with generic OG card for now — dynamic OG in Week 9).
- [ ] "Prati meč" button with FCM token generation + subscription to `/pushSubscriptions`.
- [ ] iOS install prompt when user on iOS Safari taps Follow.
- [ ] Cloud Function `onMatchEvent` → FCM push for matchStart / goal / matchEnd.

**End of week checkpoint:** Stefan's phone receives push when a test reporter logs a goal from another phone.

---

## Week 6 — May 23–29: Knockout, standings, shootouts
**Goal:** Automatic standings calculation; knockout bracket works end-to-end including shootouts.

- [ ] `<GroupStandings>` rendering with tiebreaker logic (H2H → GD → GF).
- [ ] Cloud Function `recomputeStandings` on match finalize.
- [ ] `<StandingRow>` with qualification indicator.
- [ ] `/nokaut` bracket page with visual tree (SVG connectors, responsive).
- [ ] `/admin/bracket` seeding UI: admin clicks "Seed bracket", function populates QF matches based on group rankings.
- [ ] `<ShootoutModal>` alternating A/B kicks.
- [ ] Shootout winner written to `match.shootoutScore`, finalizes the match.
- [ ] Auto-propagation Cloud Function: winner of QF1 → advances to SF1 team slot A (etc.).
- [ ] `<ScoreDisplay>` supports displaying shootout score parenthetically: `3:3 (4:2)`.
- [ ] `<BracketNode>` shows shootout result when applicable.
- [ ] Abandoned match handling (admin marks abandoned, standings skip).

**End of week checkpoint:** Full simulated group stage → bracket auto-populates → knockout plays out → shootout resolves. Tested on two devices.

---

## Week 7 — May 30–June 5: Photos, gallery, moderation, push broadcasts
**Goal:** Anyone can upload. Stefan can moderate from phone. Approved photos appear instantly in gallery.

- [ ] `<UploadModal>` with file picker, preview, tags (match/team/day), uploader name optional.
- [ ] Client validation: file count, size, mime, video duration.
- [ ] App Check enabled on callable functions.
- [ ] `createPhotoRecord` Cloud Function with IP-hash rate limit (5/hour).
- [ ] Firebase Extension: Resize Images configured (thumbnail 400, medium 1200).
- [ ] `/galerija` public page with filter chips (match/team/day, photo/video) and infinite scroll.
- [ ] `<Lightbox>` with keyboard nav.
- [ ] Video inline playback with native controls.
- [ ] `/admin/galerija` moderation: pending / approved / rejected tabs.
- [ ] `<ModerationCard>` with approve / reject / tag actions.
- [ ] `approvePhoto` and `rejectPhoto` Cloud Functions.
- [ ] Hourly email digest to Stefan for pending photos (Trigger Email extension or SendGrid).
- [ ] Scheduled daily function to purge rejected photos older than 7 days.
- [ ] `/admin/obavestenja` announcements CRUD.
- [ ] Urgent announcement → broadcast push to subscribers.
- [ ] `<AnnouncementBanner>` dismissible on public site.

**End of week checkpoint:** Test upload from a random phone → Stefan gets email → approves on his phone → photo appears in gallery.

---

## Week 8 — June 6–12: Side features + stats + polish
**Goal:** All remaining surface area filled in.

- [ ] Top scorers auto-computed: Cloud Function aggregates goal events per player on event create.
- [ ] `<TopScorersList>` on `/statistika`.
- [ ] Discipline stats: yellow/red counts per player, displayed on `/statistika` and player pages.
- [ ] `/admin/kup-sanka` editor + `<KupSankaLeaderboard>` on public stats page.
- [ ] `/admin/precka` editor + `<CrossbarBracket>` on public stats page.
- [ ] `/admin/sponzori` CRUD + `<SponsorGrid>` + `<SponsorTicker>` in footer.
- [ ] `/sponzori` public page with tiers.
- [ ] `/admin/nagrade` — awards entry (champions, MVP, runner-up, 3rd, top scorer, team of the tournament).
- [ ] `<AwardsBoard>` on public stats page (visible once populated).
- [ ] `<FanVotePoll>` on `/statistika` once admin opens a poll.
- [ ] `/admin/glasanje` poll management.
- [ ] One vote per device enforced via cookie + security rule.
- [ ] `/admin/korisnici` invite management + reporter promote/demote.

**End of week checkpoint:** Every feature from `SPEC.md` has at least one end-to-end path working. Polish pass begins.

---

## Week 9 — June 13–19: Production hardening + hosting migration
**Goal:** Dynamic OG cards. Full offline resilience. Bug bash. Deploy to production domain.

- [ ] Switch hosting from GitHub Pages to Firebase Hosting (or Vercel).
- [ ] Set up rewrites: `/utakmica/:matchId` → Cloud Function that fetches match + injects OG meta in HTML.
- [ ] `generateOgCard` Cloud Function rendering per-match PNG to `/og-cards/{matchId}.png`.
- [ ] Trigger OG regeneration on match status + score changes (throttled to 30s).
- [ ] Custom domain configured (when Stefan provides it).
- [ ] Full offline drill: reporter logs 10 events offline, reconnects, confirms all synced.
- [ ] Cross-browser test: Chrome Android, Safari iOS, Chrome desktop, Safari macOS, Firefox.
- [ ] Performance audit: Lighthouse on public pages; LCP ≤ 2.5s on 4G.
- [ ] Bundle audit: initial JS ≤ 250 KB gzipped. Code-split admin.
- [ ] Rules test suite run in CI. Firestore + Storage rules deployed.
- [ ] Backup strategy: weekly Firestore export scheduled.
- [ ] Error monitoring: Crashlytics wired (or Sentry, decide with Stefan).
- [ ] Archive 2025: `/2025` static page recreated from current Webflow content.
- [ ] Public soft launch: share site link with small test audience, collect feedback.

**End of week checkpoint:** Site is live at production domain. Real photos and announcements flowing in.

---

## Week 10 — June 20–27: Reporter training + final bug fixes + tournament
**Goal:** Reporters confident. Zero known critical bugs. Tournament goes smooth.

- [ ] **June 20:** Reporter training session (in person or video call).
  - Walkthrough of match editor on phones.
  - Practice match with fake data.
  - Review edge cases (wrong scorer, shootout, offline).
  - Share crisis contacts (Stefan's phone) for tournament day.
- [ ] Polish based on training feedback.
- [ ] Final bug fixes from soft-launch audience.
- [ ] Pre-tournament content population: teams, players, roster photos, sponsors all in place.
- [ ] Full schedule entered + double-checked.
- [ ] **June 26 (eve):** Rehearsal — one full match simulation end-to-end.
- [ ] **June 27–28:** Tournament. Stefan + reporters operate the app live.
- [ ] Post-tournament: awards populated, archive tournament, begin `/sampioni` update.

---

## Scope cut priorities (if weeks slip)

Cut in this order — **top of list is first to cut**:

1. Fan voting (MVP + best goal) — niche, late-tournament feature.
2. Crossbar competition tracking — admin can post results as a static page instead.
3. Team of the tournament / awards — can be added post-tournament.
4. Kup Šanka — can be done on paper for 2026.
5. Substitutions tracking — uncommon in small-sided, rarely updated.
6. Champions history page — can be populated after tournament.
7. Announcements broadcast push — announcements still work as banner without push.
8. Push notifications — live page refresh is enough for most users.
9. Sponsors section — can be added late or linked to last year's list.
10. PWA install prompt polish — users can still use the site from browser.

**Never cut:**
- Match editor (score + events + clock + offline).
- Live score updates for public.
- Photo upload + moderation.
- Standings + bracket.
- Public match detail page.
- Schedule page.

These are the tournament.

---

## Post-tournament (July–onwards)

- [ ] Post-mortem: what worked, what broke.
- [ ] Archive 2026 tournament properly.
- [ ] Backfill missed features cut from scope.
- [ ] Year-over-year: improvements for 2027.
- [ ] Document runbook for future reporters (even if the app is self-explanatory).

---

## Risk watchlist

| Risk | Mitigation |
|---|---|
| Stadium Wi-Fi fails | Firestore offline persistence + append-only events. Tested in Week 4 and Week 9. |
| Reporter logs wrong event | Admin can soft-delete any event after the fact. |
| Two reporters edit same match | `clientEventId` prevents duplicates; admin dedupes if they happen. |
| iOS push doesn't fire | Install-to-home-screen prompt; fall back to manual refresh. Tested in Week 5. |
| Spam photo uploads | IP rate limit + App Check. Tested in Week 7. |
| Custom domain not ready | Site lives at GitHub Pages URL until the domain arrives. OG cards deferred. |
| Firebase quotas exceeded | Unlikely for small tournament (est < 10k reads/day). Pricing alerts at 80%. |
| Reporter forgets password / link | No passwords (magic link). Stefan can re-send invite. |
| Cloud Function cold start makes live feel laggy | Keep functions minimal. Use onSnapshot for live UI — doesn't go through functions. |
| Logo quality on large displays | 68 KB SVG is a raster; make a vector version for display sizes if possible. |

---

## Dependencies & blocked items

- **Logo quality:** current `/assets/logo.svg` is a rasterized SVG (raster embedded in SVG wrapper). May pixelate at large sizes. Before Week 1 ends, confirm with Stefan whether to commission a true-vector redraw.
- **Production domain:** needed before Week 9 (OG card setup + hosting migration). Stefan to provide.
- **Reporter list:** Stefan to confirm names + emails by end of Week 8 so invites can go out Week 10 training.
- **2025 archive content:** Stefan to confirm what gets preserved at `/2025` (Week 3 task depends on this).
- **Sponsor logos and info:** by end of Week 7 to populate Week 8.

---

## Working cadence

- Weekly check-in: Stefan reviews progress every Friday; adjusts scope for following week.
- No feature merges Thursday afternoon before a release — always leave Friday for bug-fix buffer.
- Main branch always deployable. Feature branches short-lived.
- Commit daily. Push daily. Deploy at least weekly.
