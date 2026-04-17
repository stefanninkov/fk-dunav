import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { matchesCol } from '@/lib/firestore/refs';
import type { Match } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

export function ResultsPage() {
  const active = useTournamentStore((s) => s.active);
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(
        matchesCol(active.id),
        where('status', '==', 'finished'),
        orderBy('scheduledStart', 'asc'),
      ),
      (snap) => setMatches(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  const { groupPhase, knockout } = useMemo(() => {
    const g: Match[] = [];
    const k: Match[] = [];
    (matches ?? []).forEach((m) => (m.phase === 'group' ? g.push(m) : k.push(m)));
    return { groupPhase: g, knockout: k };
  }, [matches]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.results} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.results}</h1>

      {matches === null ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : matches.length === 0 ? (
        <p className="mt-6 text-sm text-ink-secondary">Još nema odigranih utakmica.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {groupPhase.length > 0 ? <Section title="Grupna faza" matches={groupPhase} /> : null}
          {knockout.length > 0 ? <Section title="Nokaut" matches={knockout} /> : null}
        </div>
      )}
    </section>
  );
}

function Section({ title, matches }: { title: string; matches: Match[] }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-600">{title}</h2>
      <ul className="flex flex-col gap-2">
        {matches.map((m) => (
          <li key={m.id} className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card">
            <span className="w-28 text-xs text-ink-tertiary">
              {m.scheduledStart.toDate().toLocaleDateString('sr-RS', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
            <span className="flex-1 text-ink-primary">
              <span className="font-500">{m.teamA.name}</span>
              <span className="mx-2 text-ink-tertiary">vs</span>
              <span className="font-500">{m.teamB.name}</span>
            </span>
            <span className="tnum font-display text-lg font-700">
              {m.score.a}:{m.score.b}
              {m.shootoutScore ? (
                <span className="ml-1 text-xs text-ink-tertiary">
                  ({m.shootoutScore.a}:{m.shootoutScore.b})
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
