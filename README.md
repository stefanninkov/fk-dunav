# FK Dunav Tournament App

Live tournament management platform for FK Dunav Ostrovo, first deployed for the **June 27–28, 2026** edition.

Replaces the static 2025 Webflow site with a dynamic app where results are updated live by a small team of reporters, visible in real time to the public, with photo/video uploads submitted openly and approved by the owner.

## Stack

React 19 · Vite · TypeScript · Tailwind CSS v4 · Zustand · Firebase (Firestore · Auth · Storage · Functions · FCM) · GSAP

## Quick start

```bash
npm install
cp .env.example .env.local           # fill in Firebase config
npm run dev                          # Vite dev server
firebase emulators:start             # Firebase services locally (separate terminal)
```

## Documentation

Start with `CLAUDE.md` — the primary context for anyone (human or AI) working on this codebase. Detailed specs in `/docs`:

| Doc | What it covers |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Project rules, conventions, commands, where to find what |
| [`docs/SPEC.md`](./docs/SPEC.md) | Complete feature specification |
| [`docs/DATA-MODEL.md`](./docs/DATA-MODEL.md) | Firestore schema, indexes, relations |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Routing, auth, offline, FCM, image pipeline |
| [`docs/SECURITY-RULES.md`](./docs/SECURITY-RULES.md) | Firestore & Storage rules, rate limiting |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | Brand, tokens, typography, components |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | 10-week build plan, risks, scope cuts |

## Brand

- Primary color: **`#01458E`** (FK Dunav blue)
- Logo: [`assets/logo.svg`](./assets/logo.svg)
- Language: Latin-script Serbian (UI); English (code)

## License

Private project, all rights reserved. FK Dunav Ostrovo.
