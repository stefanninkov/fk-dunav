import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import { matchesCol } from '@/lib/firestore/refs';
import type { Match } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

export function SchedulePage() {
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

  const byDay = useMemo(() => {
    const out = new Map<string, Match[]>();
    if (!matches) return out;
    for (const m of matches) {
      const day = m.scheduledStart.toDate().toISOString().slice(0, 10);
      const list = out.get(day) ?? [];
      list.push(m);
      out.set(day, list);
    }
    return out;
  }, [matches]);

  if (!active) {
    return (
      <PagePlaceholder
        title={sr.nav.schedule}
        description="Čeka se aktivan turnir."
      />
    );
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.schedule}</h1>

      {matches === null ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : matches.length === 0 ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.empty}</p>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {[...byDay.entries()].map(([day, dayMatches]) => (
            <DaySection key={day} day={day} matches={dayMatches} />
          ))}
        </div>
      )}
    </section>
  );
}

function DaySection({ day, matches }: { day: string; matches: Match[] }) {
  const byField = new Map<string, Match[]>();
  for (const m of matches) {
    const list = byField.get(m.field) ?? [];
    list.push(m);
    byField.set(m.field, list);
  }
  const dayLabel = new Date(day).toLocaleDateString('sr-RS', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-600 capitalize">{dayLabel}</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[...byField.entries()].map(([field, list]) => (
          <div key={field} className="rounded-lg bg-surface-1 p-4 shadow-card">
            <h3 className="mb-3 text-xs uppercase tracking-wide text-ink-tertiary">{field}</h3>
            <ul className="flex flex-col divide-y divide-surface-3">
              {list.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchRow({ match }: { match: Match }) {
  const time = match.scheduledStart.toDate().toLocaleTimeString('sr-RS', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const live = match.status === 'live';
  const finished = match.status === 'finished';

  return (
    <li className="flex items-center gap-3 py-3 text-sm">
      <span className="tnum w-12 text-ink-secondary">{time}</span>
      <div className="flex-1 flex-col">
        <span className="text-ink-primary">{match.teamA.name}</span>
        <span className="mx-2 text-ink-tertiary">vs</span>
        <span className="text-ink-primary">{match.teamB.name}</span>
      </div>
      {finished ? (
        <span className="tnum font-display text-lg font-700">
          {match.score.a}:{match.score.b}
        </span>
      ) : live ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-live-soft px-2 py-0.5 text-xs font-600 text-live">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
          {sr.match.status.live}
        </span>
      ) : (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
          {sr.match.status.scheduled}
        </span>
      )}
    </li>
  );
}
