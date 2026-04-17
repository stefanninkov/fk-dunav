import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { onSnapshot, query, where } from 'firebase/firestore';

import { matchesCol } from '@/lib/firestore/refs';
import type { Match } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

export function LivePage() {
  const active = useTournamentStore((s) => s.active);
  const [live, setLive] = useState<Match[] | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(matchesCol(active.id), where('status', '==', 'live')),
      (snap) => setLive(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.live} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.live}</h1>

      {live === null ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : live.length === 0 ? (
        <p className="mt-6 text-sm text-ink-secondary">
          Trenutno nema utakmica u toku. Pogledaj{' '}
          <NavLink to="/raspored" className="text-brand-400 hover:text-brand-300">
            raspored
          </NavLink>
          .
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {live.map((m) => (
            <li key={m.id}>
              <NavLink
                to={`/utakmica/${m.id}`}
                className="flex flex-col gap-3 rounded-lg bg-surface-1 p-5 shadow-card hover:shadow-glow"
              >
                <span className="inline-flex items-center gap-2 self-start rounded-full bg-live-soft px-2 py-0.5 text-xs font-600 text-live">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
                  {sr.match.status.live} · {m.clock.displayMinute}'
                </span>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex-1 font-display text-xl font-600 text-ink-primary">
                    {m.teamA.name}
                  </span>
                  <span className="tnum font-display text-4xl font-700 text-ink-primary">
                    {m.score.a}:{m.score.b}
                  </span>
                  <span className="flex-1 text-right font-display text-xl font-600 text-ink-primary">
                    {m.teamB.name}
                  </span>
                </div>
                <span className="text-xs text-ink-tertiary">{m.field}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
