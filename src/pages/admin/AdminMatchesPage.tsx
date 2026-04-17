import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import { matchesCol } from '@/lib/firestore/refs';
import type { Match } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';

export function AdminMatchesPage() {
  const active = useTournamentStore((s) => s.active);
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(matchesCol(active.id), orderBy('scheduledStart', 'asc')),
      (snap) => setMatches(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  if (!active) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.matches}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-700">{sr.admin.nav.matches}</h1>

      {matches === null ? (
        <p className="text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : matches.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-secondary">
          {sr.common.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {matches.map((m) => (
            <li key={m.id}>
              <NavLink
                to={`/admin/utakmice/${m.id}`}
                className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card hover:shadow-card-hov"
              >
                <span className="tnum w-28 text-xs text-ink-tertiary">
                  {m.scheduledStart.toDate().toLocaleString('sr-RS', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="flex-1 text-ink-primary">
                  <span className="font-500">{m.teamA.name}</span>
                  <span className="mx-2 text-ink-tertiary">vs</span>
                  <span className="font-500">{m.teamB.name}</span>
                </span>
                {m.status === 'finished' ? (
                  <span className="tnum font-display font-700">
                    {m.score.a}:{m.score.b}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    m.status === 'live'
                      ? 'bg-live-soft text-live'
                      : m.status === 'finished'
                        ? 'bg-success-soft text-success'
                        : 'bg-surface-2 text-ink-secondary'
                  }`}
                >
                  {sr.match.status[m.status]}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
