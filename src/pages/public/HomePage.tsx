import { Navigate } from 'react-router-dom';

import { sr } from '@/i18n/sr';
import { Countdown } from '@/features/home/Countdown';
import { useTournamentStarted } from '@/hooks/useTournamentStarted';

const TOURNAMENT_START = new Date('2026-06-27T11:00:00+02:00');

export function HomePage() {
  const started = useTournamentStarted();

  // Once the countdown has fired, the home page is no longer the most
  // useful landing — drop visitors straight onto Grupe where the live
  // group standings live.
  if (started) {
    return <Navigate to="/grupe" replace />;
  }

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
        <p className="mt-4 max-w-3xl font-display text-2xl font-600 text-white sm:text-3xl lg:text-4xl">
          {sr.brand.tagline}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-ink-tertiary">
            Do početka turnira
          </span>
          <Countdown target={TOURNAMENT_START} />
        </div>
      </div>
    </section>
  );
}
