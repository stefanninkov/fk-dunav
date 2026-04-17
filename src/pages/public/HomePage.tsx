import { NavLink } from 'react-router-dom';

import { sr } from '@/i18n/sr';
import { Countdown } from '@/features/home/Countdown';

const TOURNAMENT_START = new Date('2026-06-27T10:00:00+02:00');
const TOURNAMENT_END_WINDOW_MS = 48 * 3_600_000;

export function HomePage() {
  const now = new Date();
  const isLive =
    now >= TOURNAMENT_START &&
    now <= new Date(TOURNAMENT_START.getTime() + TOURNAMENT_END_WINDOW_MS);

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
          <div className="mt-8 flex flex-col gap-3">
            <span className="text-xs uppercase tracking-wide text-ink-tertiary">
              Do početka turnira
            </span>
            <Countdown target={TOURNAMENT_START} />
          </div>
        )}
      </div>
    </section>
  );
}

