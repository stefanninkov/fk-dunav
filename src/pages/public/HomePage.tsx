import { NavLink } from 'react-router-dom';

import { sr } from '@/i18n/sr';

const TOURNAMENT_START = new Date('2026-06-27T10:00:00+02:00');

function formatRemaining(target: Date, now: Date) {
  const diff = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return { days, hours };
}

export function HomePage() {
  const now = new Date();
  const { days, hours } = formatRemaining(TOURNAMENT_START, now);
  const isLive = now >= TOURNAMENT_START && now <= new Date(TOURNAMENT_START.getTime() + 48 * 3_600_000);

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-900/60 via-surface-0 to-surface-0" />
      <div className="relative mx-auto flex min-h-[60vh] max-w-[1200px] flex-col items-start justify-center px-page-x py-16 lg:px-page-x-lg">
        <div className="flex items-center gap-3 rounded-full bg-surface-2 px-3 py-1 text-xs font-500 text-ink-secondary">
          <span className="h-2 w-2 rounded-full bg-brand-400" />
          27–28. jun 2026 · Ostrovo
        </div>

        <h1 className="mt-5 font-display text-4xl font-700 leading-tight text-ink-primary sm:text-5xl lg:text-6xl">
          {sr.brand.tournament}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink-secondary sm:text-lg">{sr.brand.tagline}</p>

        {isLive ? (
          <NavLink
            to="/uzivo"
            className="mt-8 inline-flex h-touch items-center gap-2 rounded-md bg-live px-5 font-600 text-ink-primary shadow-glow"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-ink-primary" />
            {sr.nav.live}
          </NavLink>
        ) : (
          <div className="mt-8 flex items-center gap-4 font-display text-ink-primary">
            <div className="flex flex-col items-center rounded-lg bg-surface-1 px-5 py-3 shadow-card">
              <span className="tnum text-3xl font-700">{days}</span>
              <span className="text-xs text-ink-tertiary">dana</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-surface-1 px-5 py-3 shadow-card">
              <span className="tnum text-3xl font-700">{hours}</span>
              <span className="text-xs text-ink-tertiary">sati</span>
            </div>
            <span className="text-sm text-ink-secondary">do početka</span>
          </div>
        )}
      </div>
    </section>
  );
}

