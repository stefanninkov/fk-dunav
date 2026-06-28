import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import { lotteryCol, lotterySessionDoc } from '@/lib/firestore/refs';
import type { LotteryPrize, LotterySession } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

/**
 * Public Lutrija page — chronological prize list with the drawn number
 * for each. Sources of truth:
 *   - participantCount on /tournaments/{tid}/lotterySession/current
 *   - LotteryPrize docs with optional winnerName (the drawn number as
 *     a string)
 */
export function LotteryLivePage() {
  const active = useTournamentStore((s) => s.active);
  const [prizes, setPrizes] = useState<LotteryPrize[]>([]);
  const [session, setSession] = useState<LotterySession | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsubPrizes = onSnapshot(
      query(lotteryCol(active.id), orderBy('order', 'asc')),
      (snap) => setPrizes(snap.docs.map((d) => d.data())),
    );
    const unsubSession = onSnapshot(lotterySessionDoc(active.id), (snap) =>
      setSession(snap.exists() ? snap.data() : null),
    );
    return () => {
      unsubPrizes();
      unsubSession();
    };
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.side.lottery.title} description="Čeka se aktivan turnir." />;
  }

  const participantCount = session?.participantCount ?? 0;
  const drawnCount = prizes.filter((p) => !!p.winnerName).length;

  return (
    <section className="mx-auto flex max-w-[900px] flex-col items-center gap-8 px-page-x py-12 lg:px-page-x-lg">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-ink-tertiary">
          {sr.brand.name}
        </span>
        <h1 className="font-display text-4xl font-700 text-ink-primary sm:text-5xl">
          {sr.side.lottery.title}
        </h1>
        <p className="text-sm text-ink-secondary">{sr.side.lottery.subtitle}</p>
        {participantCount > 0 ? (
          <p className="tnum text-xs uppercase tracking-wide text-ink-tertiary">
            Bubanj: {participantCount} listića · izvučeno {drawnCount} / {prizes.length}
          </p>
        ) : null}
      </header>

      <div className="w-full">
        {prizes.length === 0 ? (
          <div className="rounded-lg bg-surface-1 p-8 text-center text-sm text-ink-tertiary shadow-elevated">
            Lista nagrada se priprema…
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {prizes.map((p, idx) => {
              const drawn = !!p.winnerName;
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-4 rounded-xl px-5 py-4 shadow-card ${
                    drawn ? 'bg-surface-1' : 'bg-surface-1/70'
                  }`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-base font-700"
                    style={{
                      backgroundColor:
                        idx === 0
                          ? 'var(--color-accent-gold)'
                          : idx === 1
                            ? 'var(--color-accent-silver)'
                            : idx === 2
                              ? 'var(--color-accent-bronze)'
                              : 'var(--color-brand-600)',
                      color: 'var(--color-ink-inverse)',
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="font-display text-lg font-500 text-ink-primary">
                      {p.label}
                    </span>
                    <span
                      className={`mt-0.5 tnum text-xl ${
                        drawn ? 'font-700 text-ink-primary' : 'italic text-ink-tertiary'
                      }`}
                    >
                      {drawn ? `Broj ${p.winnerName}` : sr.side.lottery.pending}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
