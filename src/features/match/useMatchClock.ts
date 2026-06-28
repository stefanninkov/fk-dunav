import { useEffect, useState } from 'react';

import type { Match } from '@/lib/firestore/types';

/**
 * Derive a ticking display minute from the match clock. When the clock is
 * running, we add elapsed seconds since `halfStartedAt` to the accumulated
 * total; when paused/halftime/ended, we freeze at `displayMinute`.
 *
 * Minutes (not seconds) are sufficient for small-sided football display
 * and avoid a 1Hz re-render across the whole admin UI.
 */
export function useMatchClock(match: Match | null): number {
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!match) return;
    const compute = () => {
      const { clock } = match;
      if (clock.state !== 'running' || !clock.halfStartedAt) {
        setMinute(clock.displayMinute);
        return;
      }
      const startedMs = clock.halfStartedAt.toMillis();
      const elapsedSeconds = Math.max(0, (Date.now() - startedMs) / 1000);
      const total = clock.accumulatedSeconds + elapsedSeconds;
      setMinute(Math.floor(total / 60));
    };
    compute();
    const id = window.setInterval(compute, 10_000);
    return () => window.clearInterval(id);
  }, [match]);

  return minute;
}
