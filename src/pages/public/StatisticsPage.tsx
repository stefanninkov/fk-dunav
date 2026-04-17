import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import { lotteryCol } from '@/lib/firestore/refs';
import type { LotteryPrize } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { LotteryBoard } from '@/features/lottery/components/LotteryBoard';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

export function StatisticsPage() {
  const active = useTournamentStore((s) => s.active);
  const [lottery, setLottery] = useState<LotteryPrize[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(lotteryCol(active.id), orderBy('order', 'asc')),
      (snap) => setLottery(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.statistics} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.statistics}</h1>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl font-600">Najbolji strelci</h2>
          <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-tertiary">
            Top lista se ažurira kako padaju golovi.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-600">Kartoni</h2>
          <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-tertiary">
            Žuti i crveni kartoni po igraču.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-600">Nagrade</h2>
          <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-tertiary">
            Šampion, vicešampion, MVP, najbolji strelac i pobednik prečke se objavljuju na kraju
            turnira.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-display text-xl font-600">{sr.side.lottery.title}</h2>
          <p className="mb-3 text-sm text-ink-tertiary">{sr.side.lottery.subtitle}</p>
          <LotteryBoard prizes={lottery} />
        </section>
      </div>
    </section>
  );
}
