import { useEffect, useState } from 'react';

import { useTournamentStore } from '@/stores/useTournamentStore';

/**
 * Hardcoded fallback so this works even if the active tournament's
 * startDate hasn't been entered yet. Mirrors HomePage's previous
 * constant — Saturday 27 June 2026 10:00 local (CEST).
 */
const FALLBACK_START = new Date('2026-06-27T10:00:00+02:00');

/**
 * Returns true once "now" is past the active tournament's startDate (or
 * the hardcoded fallback if no tournament is loaded). Re-renders every
 * minute while the countdown is still running so consumers don't need
 * to sit on a refresh.
 */
export function useTournamentStarted(): boolean {
  const active = useTournamentStore((s) => s.active);
  const start = active?.startDate?.toDate?.() ?? FALLBACK_START;

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (now >= start) return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [now, start]);

  return now >= start;
}
