# CLAUDE.md — FK Dunav Tournament App

This file is the primary context for Claude Code working on this project. Read it first every session. Detailed specs live in `/docs`.

---

## Project identity

Reusable tournament platform for **FK Dunav Ostrovo**, first deployed for the 2026 edition on **June 27–28, 2026**. Replaces the Webflow static site from 2025 (`https://fk-dunav.webflow.io/`) with a dynamic app where live results, match events, photos, and side competitions are updated in real time by multiple reporters and visible live to the public.

**Owner:** Stefan (sole developer) — `stefan.ninkov@gmail.com` is the sole bootstrap admin; added manually to the `/adminEmails` Firestore collection via Firebase console before first deploy. All other admins/reporters are invited later through `/admin/korisnici`.
**Brand:** FK Dunav blue `#01458E`, logo in `/assets/logo.svg` (68KB SVG with embedded raster).
**Language:** Latin-script Serbian throughout the UI. No Cyrillic, no English toggle.
**Deadline:** Tournament kicks off **June 27, 2026** — the site must be fully operational with reporters trained by **June 20, 2026**.

---

## Stack (non-negotiable)

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4
- **State:** Zustand
- **Backend:** Firebase — Firestore (realtime + offline persistence), Auth, Storage, Cloud Functions, FCM (web push)
- **Routing:** React Router v7
- **Forms:** React Hook Form + Zod validation
- **Animation:** GSAP (all rules from Stefan's memory apply — `rem` not `px`, kill instances on route change, `prefers-reduced-motion` respected, etc.)
- **Hosting (initial):** GitHub Pages (static SPA, Firebase backend)
- **Hosting (production):** Firebase Hosting or Vercel (migration required for per-match OG cards — see `/docs/ARCHITECTURE.md`)

Do **not** introduce Next.js, Remix, Redux, MUI, Chakra, styled-components, or any alternative stack choices without explicit confirmation from Stefan.

---

## Directory structure

```
fk-dunav-tournament/
├── CLAUDE.md                 ← you are here
├── README.md                 ← user-facing setup instructions
├── docs/
│   ├── SPEC.md               ← full feature specification
│   ├── DATA-MODEL.md         ← Firestore schema, collections, indexes
│   ├── ARCHITECTURE.md       ← routing, auth, offline, FCM, image pipeline
│   ├── SECURITY-RULES.md     ← Firestore + Storage rules logic
│   ├── DESIGN.md             ← brand, tokens, component system
│   └── ROADMAP.md            ← 10-week sprint plan
├── assets/
│   └── logo.svg              ← brand logo
├── src/
│   ├── app/                  ← root App, Router, providers
│   ├── pages/                ← route-level components (public + /admin)
│   ├── components/           ← shared components (no business logic)
│   ├── features/             ← feature modules (match, team, gallery, etc.)
│   ├── lib/
│   │   ├── firebase.ts       ← initialized Firebase SDK
│   │   ├── firestore/        ← typed Firestore converters + helpers
│   │   └── utils/            ← pure helpers (standings calc, time format, etc.)
│   ├── stores/               ← Zustand stores
│   ├── hooks/                ← shared React hooks
│   ├── i18n/                 ← Serbian UI strings
│   └── styles/               ← Tailwind config extensions, global CSS
├── functions/                ← Firebase Cloud Functions
├── firestore.rules           ← security rules
├── storage.rules             ← storage security rules
├── firebase.json             ← Firebase project config
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## Commands

```bash
# Development
npm run dev                   # Vite dev server (port 5173)
npm run build                 # Production build → dist/
npm run preview               # Preview production build
npm run typecheck             # tsc --noEmit
npm run lint                  # ESLint

# Firebase
firebase emulators:start      # Local Firestore + Auth + Functions + Storage emulators
firebase deploy               # Full deploy (functions + rules + hosting)
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
firebase deploy --only hosting

# Cloud Functions (inside /functions)
cd functions && npm run build # TypeScript compile
cd functions && npm run serve # Local emulator

# Deployment to GitHub Pages (initial)
npm run deploy:gh             # Builds and pushes to gh-pages branch
```

Add these scripts when scaffolding. Use GitHub Actions for automated build + deploy on push to `main`.

---

## Coding conventions

### Language & style
- **TypeScript strict mode.** No `any` unless absolutely unavoidable and commented why.
- **English for all code, comments, file names, variable names, commit messages.**
- **Serbian Latin for user-visible text only**, centralized in `src/i18n/sr.ts`. Never inline Serbian strings in components.
- **Always provide complete code** in responses — never partial snippets or "only the changed lines". This is Stefan's rule.
- **Do not remove comments** when editing existing code unless Stefan explicitly asks.
- **When uncertain about a class name, selector, or wrapper name — ask Stefan, do not invent one.**

### React
- Functional components only. No class components.
- Named exports for components, default export only for route pages.
- Prop types via TypeScript interfaces. No PropTypes.
- One component per file. File name = component name (PascalCase).
- Custom hooks prefixed `use*` and live in `src/hooks/` if shared or next to the component if local.

### Styling
- **Tailwind v4** for everything. No CSS-in-JS. Minimal global CSS.
- Design tokens defined in `tailwind.config.ts` — never hardcode colors or spacing. Always reference tokens (`bg-brand-blue`, not `bg-[#01458E]`).
- Mobile-first. Default styles target mobile, `sm:`, `md:`, `lg:` scale up.
- Touch targets minimum 44×44px on mobile (reporters using phones at a stadium).

### GSAP rules (when animations are used)
All of Stefan's standing GSAP rules apply — see his memory. Highlights:
- `rem` not `px` for all animation values.
- Kill ScrollTrigger instances and timelines on route change: `ScrollTrigger.getAll().forEach(t => t.kill())`.
- `will-change: transform` before animation, remove via `gsap.set()` after.
- Never animate layout properties (width, height, padding). Use transform and opacity only; use Flip plugin if layout change is required.
- Wrap init in `DOMContentLoaded` or equivalent React lifecycle (`useEffect` with proper cleanup).
- Always respect `prefers-reduced-motion`.

### Firestore
- Always use typed converters (see `src/lib/firestore/converters.ts`). Never read/write raw `DocumentData`.
- Subcollections for one-to-many where the children are only meaningful in the parent's context (match → events, team → players).
- Top-level collections for entities queried across parents (users, push subscriptions).
- Write operations should use `serverTimestamp()` for any time field that must be authoritative.
- Listeners: always clean up in `useEffect` return. Document this in every feature.

### Git commits
- Conventional Commits format: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.
- Scope where helpful: `feat(match): add penalty shootout UI`.
- Short imperative subject (≤ 72 chars), body explaining _why_ if non-obvious.

---

## Critical project rules

1. **Offline-first for reporters.** Match updates must never be lost if Wi-Fi drops at the stadium. Firestore offline persistence is mandatory; events are append-only (no mutations) so merge conflicts are avoided by design. See `/docs/ARCHITECTURE.md` → Offline strategy.

2. **Public site is read-only, anonymous.** No login required to view anything. No tracking beyond basic anonymous analytics.

3. **Photo uploads are open but moderated.** Anyone can submit, Stefan (and any user with `admin` role) approves. Unapproved photos are NEVER visible on the public site — enforce via security rules, not just UI.

4. **Roles are stored in Firebase Auth custom claims**, not in Firestore user docs. Firestore `/users/{uid}` is for profile data only. Claims must be set by a Cloud Function triggered by an admin action.

5. **Tournament lifecycle:** only one tournament is `active` at a time. Historical tournaments become read-only. The 2025 Webflow data is archived at route `/2025` as a static replica of last year's site for continuity.

6. **Rate limit anonymous photo uploads** at 5 per IP per hour, enforced by Cloud Function on upload. App Check must be enabled to prevent abuse.

7. **Never block on the match clock.** If a reporter's clock is out of sync with reality, they can always override the displayed minute manually per event. The clock is a convenience, not a source of truth.

8. **Tiebreaker logic is fixed this year but implemented as a pluggable function** (H2H → GD → GF). Future tournaments may override.

9. **Do not mention or reference Stefan's other projects (AEO Dashboard, Forge) in this codebase.** This is FK Dunav's project, keep it separate.

10. **Firestore security rules are the security model.** Never rely on UI checks alone for access control. Every write path must be validated server-side.

---

## What NOT to do

- Do not use localStorage or sessionStorage for app state (use Zustand + Firestore). IndexedDB is fine via Firestore persistence.
- Do not add a backend server (Express, Fastify). Everything dynamic goes through Cloud Functions.
- Do not add a database ORM (Prisma, Drizzle). Firestore is schemaless by design; typed converters are the pattern.
- Do not use Webflow native interactions, Barba.js, or Splide.js v3.2.2 (known bugs — see Stefan's memory).
- Do not add analytics or tracking scripts beyond Firebase Analytics (and only if Stefan confirms).
- Do not auto-generate fixtures. Stefan entered the 2025 schedule manually and will do the same. Building a round-robin generator is out of scope for the 2026 deadline.
- Do not build the champions history feature by scraping — each edition's winners are entered manually into `/tournaments/{id}/awards`.

---

## Where to find what

| Question | Document |
|---|---|
| What does the app do? | `/docs/SPEC.md` |
| What's the data shape? | `/docs/DATA-MODEL.md` |
| How does auth / offline / push work? | `/docs/ARCHITECTURE.md` |
| Who can read/write what? | `/docs/SECURITY-RULES.md` |
| What does it look like? | `/docs/DESIGN.md` |
| What's the build plan? | `/docs/ROADMAP.md` |

When in doubt, read `SPEC.md` first, then drill into the relevant doc. If the doc doesn't cover something, **ask Stefan rather than invent the answer**.
