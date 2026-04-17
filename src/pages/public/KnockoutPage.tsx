import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { onSnapshot, query, where } from 'firebase/firestore';

import { matchesCol } from '@/lib/firestore/refs';
import type { KnockoutRound, Match } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

const roundOrder: { id: KnockoutRound; label: string }[] = [
  { id: 'qf', label: 'Četvrtfinale' },
  { id: 'sf', label: 'Polufinale' },
  { id: 'thirdPlace', label: '3. mesto' },
  { id: 'final', label: 'Finale' },
];

export function KnockoutPage() {
  const active = useTournamentStore((s) => s.active);
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(matchesCol(active.id), where('phase', '==', 'knockout')),
      (snap) => setMatches(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  const byRound = useMemo(() => {
    const map = new Map<KnockoutRound, Match[]>();
    (matches ?? []).forEach((m) => {
      if (!m.knockoutRound) return;
      const list = map.get(m.knockoutRound) ?? [];
      list.push(m);
      map.set(m.knockoutRound, list);
    });
    for (const list of map.values()) {
      list.sort((a, b) => (a.bracketSlot ?? '').localeCompare(b.bracketSlot ?? ''));
    }
    return map;
  }, [matches]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.knockout} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1400px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.knockout}</h1>

      {matches === null ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : matches.length === 0 ? (
        <p className="mt-6 text-sm text-ink-secondary">
          Raspored nokauta se popunjava nakon grupne faze.
        </p>
      ) : (
        <div className="mt-10 overflow-x-auto">
          <div className="flex min-w-max items-stretch gap-6">
            {roundOrder
              .filter((r) => (byRound.get(r.id)?.length ?? 0) > 0)
              .map((r) => (
                <div key={r.id} className="flex min-w-[240px] flex-col gap-3">
                  <h2 className="font-display text-sm font-600 uppercase tracking-wide text-ink-secondary">
                    {r.label}
                  </h2>
                  <div className="flex flex-col justify-around gap-4 self-stretch">
                    {(byRound.get(r.id) ?? []).map((m) => (
                      <BracketNode key={m.id} match={m} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BracketNode({ match }: { match: Match }) {
  const aWon =
    match.status === 'finished'
      ? (match.shootoutScore
          ? match.shootoutScore.a > match.shootoutScore.b
          : match.score.a > match.score.b)
      : null;
  const bWon = aWon === null ? null : !aWon && match.score.a !== match.score.b;

  return (
    <NavLink
      to={`/utakmica/${match.id}`}
      className="flex flex-col gap-1 rounded-lg bg-surface-1 p-3 shadow-card hover:shadow-card-hov"
    >
      <Row
        name={match.teamA.name}
        score={match.status === 'finished' ? match.score.a : null}
        won={aWon ?? false}
      />
      <Row
        name={match.teamB.name}
        score={match.status === 'finished' ? match.score.b : null}
        won={bWon ?? false}
      />
      {match.shootoutScore ? (
        <p className="pt-1 text-center text-xs text-ink-tertiary">
          Penali: {match.shootoutScore.a}:{match.shootoutScore.b}
        </p>
      ) : null}
      <p className="text-center text-[10px] uppercase tracking-wide text-ink-tertiary">
        {match.bracketSlot ?? '—'} · {sr.match.status[match.status]}
      </p>
    </NavLink>
  );
}

function Row({ name, score, won }: { name: string; score: number | null; won: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded px-2 py-1 ${
        won ? 'bg-brand-900 text-brand-200' : 'text-ink-primary'
      }`}
    >
      <span className="font-500">{name}</span>
      <span className="tnum font-display font-700">{score ?? '—'}</span>
    </div>
  );
}
