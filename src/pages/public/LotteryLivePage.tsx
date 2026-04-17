import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import logoUrl from '@/assets/logo.svg';
import { lotteryCol } from '@/lib/firestore/refs';
import type { LotteryPrize } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { LotteryBoard } from '@/features/lottery/components/LotteryBoard';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

/**
 * Big-screen "live draw" view for projectors / TVs at the venue. Reads
 * only revealed prizes from /tournaments/{id}/lottery in real time and
 * animates each new row via LotteryBoard's built-in GSAP pop. Kept
 * intentionally minimal — no nav, no chrome — so it looks clean on an
 * overhead display.
 */
export function LotteryLivePage() {
  const active = useTournamentStore((s) => s.active);
  const [prizes, setPrizes] = useState<LotteryPrize[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(lotteryCol(active.id), orderBy('order', 'asc')),
      (snap) => setPrizes(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.side.lottery.title} description="Čeka se aktivan turnir." />;
  }

  const revealed = prizes.filter((p) => p.revealed);

  return (
    <section className="min-h-screen bg-gradient-to-b from-brand-900 via-surface-0 to-surface-0">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-10 px-page-x py-14 lg:px-page-x-lg">
        <header className="flex flex-col items-center gap-3 text-center">
          <img src={logoUrl} alt={sr.brand.name} className="h-20 w-20" />
          <span className="text-xs uppercase tracking-[0.3em] text-ink-tertiary">
            {sr.brand.name}
          </span>
          <h1 className="font-display text-5xl font-700 text-ink-primary sm:text-6xl">
            {sr.side.lottery.title}
          </h1>
          <p className="text-base text-ink-secondary">
            Dobitnici nagrada se objavljuju uživo.
          </p>
        </header>

        <div className="w-full">
          {revealed.length === 0 ? (
            <div className="rounded-lg bg-surface-1 p-10 text-center text-base text-ink-tertiary shadow-elevated">
              Izvlačenje počinje uskoro…
            </div>
          ) : (
            <LotteryBoard prizes={prizes} variant="big" />
          )}
        </div>

        <p className="text-xs text-ink-tertiary">
          {revealed.length} / {prizes.length} nagrada objavljeno
        </p>
      </div>
    </section>
  );
}
