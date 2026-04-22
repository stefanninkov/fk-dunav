import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

import { awardsCol } from '@/lib/firestore/refs';
import type { Award, AwardId } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

/**
 * Public /nagrade — tournament awards only. Prečka, Kup Šanka and
 * Lutrija live in their own sibling tabs under the Nagrade dropdown
 * group in the header.
 */

const tournamentAwardOrder: AwardId[] = [
  'champion',
  'runnerUp',
  'thirdPlace',
  'mvp',
  'topScorer',
  'crossbarWinner',
  'teamOfTournament',
];

const PENDING = 'Uskoro';

export function PublicAwardsPage() {
  const active = useTournamentStore((s) => s.active);
  const [awards, setAwards] = useState<Record<string, Award>>({});

  useEffect(() => {
    if (!active) return;
    return onSnapshot(awardsCol(active.id), (snap) => {
      const map: Record<string, Award> = {};
      for (const d of snap.docs) map[d.id] = d.data();
      setAwards(map);
    });
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.awards} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1000px] px-page-x py-10 lg:px-page-x-lg">
      <header>
        <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.awards}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Zvanične nagrade turnira.
        </p>
      </header>

      <ul className="mt-10 flex flex-col gap-2">
        {tournamentAwardOrder.map((id) => {
          const a = awards[id];
          const winner = a?.playerName ?? a?.teamName ?? null;
          return (
            <li
              key={id}
              className={`flex items-center gap-4 rounded-lg px-4 py-3 shadow-card ${
                winner ? 'bg-surface-1' : 'bg-surface-1/60'
              }`}
            >
              <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-ink-tertiary">
                {sr.admin.awards.ids[id]}
              </span>
              <span
                className={
                  winner ? 'font-500 text-ink-primary' : 'italic text-ink-tertiary'
                }
              >
                {winner ?? PENDING}
              </span>
              {winner && a?.teamName && a?.playerName ? (
                <span className="text-xs text-ink-tertiary">{a.teamName}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
