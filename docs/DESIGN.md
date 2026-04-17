# DESIGN.md — Design System

The visual language for FK Dunav Tournament. This doc defines design tokens, typography, layout principles, and the component inventory. All components reference tokens — never hardcode values.

---

## 1. Brand

- **Primary color:** FK Dunav blue — `#01458E`
- **Logo:** `/assets/logo.svg` (68 KB SVG, raster embedded)
- **Voice:** local, friendly, competitive, proud. Not corporate.
- **Typography personality:** modern, legible, a bit sporty. Sans-serif primary, potential secondary for display.

---

## 2. Color tokens

Dark theme is the **default** (last year's Webflow site used a darker feel; it holds up well on phones in daylight when reporters use the dashboard; it reads well as a "stadium at night" aesthetic).

Define in `tailwind.config.ts` under `theme.extend.colors`:

```ts
colors: {
  // Brand
  brand: {
    DEFAULT: '#01458E',
    50:  '#E6EEF7',
    100: '#CCDDEF',
    200: '#99BBDF',
    300: '#6699CE',
    400: '#3377BE',
    500: '#0055AE',
    600: '#01458E',   // ← main brand blue
    700: '#013570',
    800: '#002651',
    900: '#001833',
    950: '#000C1A',
  },

  // Surfaces (dark theme base)
  surface: {
    0:   '#0A0E14',       // app background
    1:   '#0F1520',       // cards / panels
    2:   '#161E2C',       // elevated panels
    3:   '#202A3C',       // hover / selected
    4:   '#2A364B',       // borders at low contrast
  },

  // Text
  ink: {
    primary:   '#F5F7FA',
    secondary: '#B4BCCC',
    tertiary:  '#7A8498',
    disabled:  '#4F586B',
    inverse:   '#0A0E14',   // on light backgrounds
  },

  // Status
  success: { DEFAULT: '#22C55E', soft: '#22C55E1A' },
  warning: { DEFAULT: '#F59E0B', soft: '#F59E0B1A' },
  danger:  { DEFAULT: '#EF4444', soft: '#EF44441A' },
  live:    { DEFAULT: '#FF3366', soft: '#FF33661A' },   // "UŽIVO" accent

  // Accents (for highlights beyond brand blue)
  accent: {
    gold:   '#F4C542',   // first place, champion
    silver: '#BFC6D1',   // second
    bronze: '#C88A5C',   // third
  },
},
```

**Usage guidelines:**
- `brand.600` is the default brand blue. Lighter shades for hover on dark; darker shades for borders on light.
- Text on `surface.0–1`: use `ink.primary` or `ink.secondary`.
- Live indicator pulse: `live.DEFAULT`.
- Champion/finalist accents: `accent.gold`, `accent.silver`, `accent.bronze`.

Light theme tokens may be added later if a toggle is introduced. For 2026, ship dark-only.

---

## 3. Typography

**Primary typeface:** `Inter` (self-hosted via `@fontsource/inter`). Fallback stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`.

**Display / headline:** `Space Grotesk` (self-hosted via `@fontsource/space-grotesk`) for large numerical readouts (scores, standings, timer) and hero headings. Fallback to Inter.

Font scale (Tailwind `fontSize`):

```ts
fontSize: {
  'xs':   ['0.75rem',   { lineHeight: '1rem' }],
  'sm':   ['0.875rem',  { lineHeight: '1.25rem' }],
  'base': ['1rem',      { lineHeight: '1.5rem' }],
  'lg':   ['1.125rem',  { lineHeight: '1.75rem' }],
  'xl':   ['1.25rem',   { lineHeight: '1.875rem' }],
  '2xl':  ['1.5rem',    { lineHeight: '2rem' }],
  '3xl':  ['1.875rem',  { lineHeight: '2.25rem' }],
  '4xl':  ['2.25rem',   { lineHeight: '2.5rem' }],
  '5xl':  ['3rem',      { lineHeight: '1.1' }],
  '6xl':  ['3.75rem',   { lineHeight: '1.05' }],
  '7xl':  ['4.5rem',    { lineHeight: '1' }],

  // Score / timer tabular numerals
  'score':      ['4rem',   { lineHeight: '1', letterSpacing: '-0.02em', fontFeatureSettings: '"tnum"' }],
  'score-lg':   ['6rem',   { lineHeight: '1', letterSpacing: '-0.02em', fontFeatureSettings: '"tnum"' }],
  'timer':      ['2rem',   { lineHeight: '1', fontFeatureSettings: '"tnum"' }],
},
```

Font weights used: 400 (body), 500 (labels), 600 (headings, buttons), 700 (hero), 800 (display numerals).

Tabular numerals (`font-feature-settings: "tnum"`) are mandatory for scores, timers, and standings to prevent layout shift during updates.

---

## 4. Spacing & layout

Tailwind's default spacing scale is retained. Additional semantic tokens:

```ts
spacing: {
  'touch': '2.75rem',   // 44px — minimum touch target
  'page-x': '1rem',     // mobile horizontal padding
  'page-x-lg': '2rem',  // desktop horizontal padding
},
```

**Container widths:**
- Public content: max `1200px`, centered.
- Dashboard content: max `1440px` but prefers full-width on desktop.
- Prose (rules page, about): max `640px`.

**Breakpoints (Tailwind defaults):**
- `sm:` 640px (large phone / small tablet)
- `md:` 768px (tablet)
- `lg:` 1024px (small desktop)
- `xl:` 1280px
- `2xl:` 1536px

**Mobile-first rule:** default styles target a 375px-wide phone. All dashboard workflows must be tested primarily on mobile; desktop is a bonus.

---

## 5. Border radius & shadows

```ts
borderRadius: {
  'xs': '0.25rem',   // inputs, chips
  'sm': '0.375rem',
  'md': '0.5rem',    // default card
  'lg': '0.75rem',   // large card
  'xl': '1rem',      // modal
  '2xl': '1.5rem',
  'full': '9999px',
},

boxShadow: {
  'card':     '0 1px 2px 0 rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04)',
  'card-hov': '0 4px 12px -2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)',
  'elevated': '0 8px 24px -4px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
  'glow':     '0 0 20px rgba(1,69,142,0.35)',   // brand glow for live / CTAs
},
```

Borders use `border-surface-4` (subtle) by default. Brand-colored borders for primary accents.

---

## 6. Iconography

- Icon library: **Lucide React** (`lucide-react`).
- Default size: `20px` for inline, `24px` for nav, `16px` for small chips.
- Stroke width: `1.75` default; `2` for emphasized.
- Football-specific icons that Lucide lacks (ball with trajectory, yellow/red card) can be custom SVGs in `src/components/icons/`.

---

## 7. Motion

All animations via **GSAP** (Stefan's standard) or CSS transitions for trivial cases. Follow his memory rules:
- `rem` not `px` for transforms.
- Respect `prefers-reduced-motion`.
- Kill instances on unmount.
- `will-change: transform` before, `gsap.set()` to clear after.

**Duration scale:**
- Micro (hover, button press): 150ms.
- Small (modal entry, toast): 250ms.
- Medium (page transition, score pop): 400ms.
- Large (hero reveal): 600–800ms.

**Easings:**
- Default: `power2.out` (GSAP) / `cubic-bezier(0.2, 0.8, 0.2, 1)` (CSS).
- Bounce (score celebration): `back.out(1.7)`.
- Linear for timers / progress bars.

**Signature interactions:**
- **Goal scored:** score number pops (scale 1 → 1.2 → 1) + brand-blue glow pulse + subtle audio ping (muteable via UI toggle stored in `useUIStore`).
- **Live indicator:** `live` color pulse at 1.2s interval.
- **Match card:** lift on hover/tap (translateY -2px + shadow elevate).
- **Bracket node:** winning team highlights with brand-blue border on finalization.

---

## 8. Sound

A single short MP3/OGG ping (< 100 KB) for goals. Preloaded. Muted by default on first visit; user toggles via header icon. Persistence via Zustand + localStorage.

Respect `prefers-reduced-motion` → also respect for sound. No autoplay beyond goal events.

---

## 9. Component inventory

Organized by feature area. Components live in `src/components/` for shared, `src/features/{feature}/components/` for feature-specific.

### 9.1 Primitives (`src/components/ui/`)
- `<Button variant="primary | secondary | ghost | danger" size="sm | md | lg" />`
- `<Input />`, `<Textarea />`, `<Select />`, `<Switch />`, `<Checkbox />`, `<Radio />`
- `<Card />` — surface-1 with shadow-card
- `<Badge variant="success | warning | danger | live | neutral" />`
- `<Avatar src? name size />` — fallback to initials
- `<Skeleton />` — shimmer loading
- `<Toast />` + `useToast()` hook
- `<Modal />` + `<Sheet />` (bottom sheet for mobile)
- `<Tabs />`
- `<Dropdown />`
- `<Tooltip />`
- `<Spinner />`
- `<OfflineBadge />` — persistent top-banner indicator

### 9.2 Layout (`src/components/layout/`)
- `<PublicLayout />` — header, nav, footer for public site
- `<AdminLayout />` — dashboard shell with side nav (desktop) / bottom nav (mobile)
- `<Header />` — brand logo, primary nav, theme toggle, sound toggle
- `<Footer />` — secondary links, sponsors mini, copyright
- `<MobileBottomNav />` — admin dashboard nav on phones
- `<BreadcrumbBar />`

### 9.3 Match components (`src/features/match/components/`)
- `<MatchCard compact | full />` — teams + score + time + status
- `<MatchList items filter />` — grouped by day/field
- `<LiveMatchCard />` — larger, auto-updating
- `<MatchTimeline events />` — chronological event log
- `<MatchEvent type playerName minute />` — single event row
- `<ScoreDisplay a b live? />` — big tabular numerals
- `<MatchClock />` — display minute from match.clock
- `<MatchStatusBadge />` — scheduled / live / finished / abandoned
- `<MatchShareButton matchId />` — WhatsApp / Instagram share
- `<FollowMatchButton matchId />` — push subscription toggle
- `<MatchGallery matchId />` — photos tagged to this match

### 9.4 Match editor (`src/features/match/components/editor/`)
- `<MatchEditorHeader />` — teams + score + clock controls
- `<ScoreButton team />` — tap to open goal modal
- `<GoalModal team players />` — scorer + assist + minute
- `<CardModal type players />` — yellow/red + minute
- `<SubstitutionModal />`
- `<ShootoutModal />` — alternating A/B kick log
- `<EventListEditor events />` — inline edit for admin
- `<ClockControls state />` — play/pause/halftime/end
- `<OfflineQueueIndicator />` — number of pending writes

### 9.5 Team components
- `<TeamCard />` — logo + name + group
- `<TeamBadge compact />` — logo + short name only
- `<TeamRoster players />`
- `<TeamMatches matches />`
- `<TeamStats />` — GF, GA, GD

### 9.6 Group / standings
- `<GroupStandings group teams />` — table layout
- `<StandingRow standing rank />`
- `<QualificationIndicator />` — colored left border on qualifying rows

### 9.7 Schedule
- `<ScheduleDay date matches />`
- `<ScheduleField field matches />`
- `<ScheduleRow match />` — time + teams + score

### 9.8 Bracket
- `<Bracket stages />` — responsive tree
- `<BracketNode match next? />`
- `<BracketLine from to />` — SVG connector
- `<ShootoutResult score />`

### 9.9 Player
- `<PlayerChip player />` — avatar + name, used in event log
- `<PlayerCard full />`
- `<PlayerStatsGrid />`
- `<PlayerSearchInput players onSelect />` — fast searchable list (used in match editor modals)

### 9.10 Gallery
- `<GalleryGrid items />`
- `<GalleryItem type url />`
- `<Lightbox items index />`
- `<VideoPlayer src />`
- `<UploadModal tournamentId />`
- `<UploadProgress />`
- `<ModerationQueue photos />` — admin view
- `<ModerationCard photo />` — approve/reject actions

### 9.11 Side features
- `<KupSankaLeaderboard entries />`
- `<CrossbarBracket participants />`
- `<AwardsBoard awards />`
- `<TopScorersList />`
- `<FanVotePoll poll />`
- `<SponsorGrid tier />`
- `<SponsorTicker />`

### 9.12 Utility
- `<AnnouncementBanner announcement />` — dismissible
- `<Countdown toDate />` — for kickoff + poll close times
- `<EmptyState icon title body action />`
- `<ErrorBoundary />`
- `<AuthGuard />`
- `<RoleGuard requires="admin" />`
- `<ScrollToTop />`

---

## 10. Layout patterns

### 10.1 Mobile-first match editor
Stacked vertically:
1. Match header (teams + score + clock) — sticky top.
2. Score buttons (big, full-width, one per team).
3. Event timeline (scrollable).
4. Clock controls — sticky bottom.

No horizontal scrolling. Everything thumb-reachable (bottom half of screen for primary actions).

### 10.2 Desktop dashboard
- Left sidebar: navigation.
- Top bar: tournament selector + user menu.
- Main area: feature content.

Collapses sidebar into drawer on `<lg:`. Bottom nav appears on `<md:`.

### 10.3 Public match detail
- Mobile: stacked vertically, timeline below score, gallery at bottom.
- Desktop: two columns — left is match + timeline, right is gallery + share + follow.

### 10.4 Bracket
- Mobile: horizontal scroll with snap points per round.
- Desktop: full tree visible, SVG connectors between nodes.

---

## 11. Accessibility baseline

- Color contrast: all text passes WCAG AA. Brand-blue on white background for buttons (`#01458E` on `#FFFFFF` passes AAA for large text, AA for body).
- Focus ring: 2px brand-blue with 2px offset, never removed.
- Keyboard: every interactive element reachable via Tab, actionable via Enter/Space.
- Screen reader: icons have `aria-label`, live score changes announce via `aria-live="polite"` region.
- Reduced motion: GSAP animations check `matchMedia('(prefers-reduced-motion: reduce)')` and short-circuit to instant state changes.
- Touch targets: ≥ 44×44px.

---

## 12. Content design (Serbian Latin)

All UI strings live in `src/i18n/sr.ts` as a flat key-value map:

```ts
export const sr = {
  common: {
    loading: 'Učitavanje…',
    save: 'Sačuvaj',
    cancel: 'Otkaži',
    delete: 'Obriši',
    // ...
  },
  match: {
    status: {
      scheduled: 'Zakazana',
      live: 'Uživo',
      finished: 'Završena',
      abandoned: 'Prekinuta',
    },
    actions: {
      start: 'Počni utakmicu',
      end: 'Završi utakmicu',
      addGoal: 'Dodaj gol',
      // ...
    },
    // ...
  },
  // etc.
};
```

Tone guidelines:
- Informal singular ("ti") in the dashboard, since it's for a small trusted group.
- Neutral formal in the public site.
- Short labels. No marketing fluff.
- Emoji used sparingly, only where it adds meaning (live indicator 🔴, champion 🏆 — never decorative).

---

## 13. Design don'ts

- No glassmorphism or heavy blur effects (performance cost on mid-range phones).
- No full-viewport hero videos (bandwidth cost, distracting).
- No placeholder illustrations from generic UI kits. If we need illustration, commission or skip.
- No automatic carousels that advance without user input.
- No pop-ups or interstitials on the public site (other than the urgent announcement banner, which is dismissible).
- No skeuomorphic "stadium grass" textures or similar. The design is modern and clean; brand identity comes from the blue, the logo, and the data presentation — not gimmicks.
