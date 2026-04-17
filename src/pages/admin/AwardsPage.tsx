import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import { lotteryCol } from '@/lib/firestore/refs';
import type { LotteryPrize } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { LotteryBoardEditor } from '@/features/lottery/components/LotteryBoardEditor';

export function AwardsPage() {
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
  const [prizes, setPrizes] = useState<LotteryPrize[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(lotteryCol(active.id), orderBy('order', 'asc')),
      (snap) => setPrizes(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  if (!active || !uid) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.awards}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-10">
      <header>
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.awards}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Šampion, vicešampion, MVP, najbolji strelac i pobednik prečke se unose u sekciji ispod.
          Lutrija ima zasebnu tablu.
        </p>
      </header>

      <section className="rounded-lg bg-surface-1 p-5 shadow-card">
        <h2 className="font-display text-lg font-600">Zvanične nagrade</h2>
        <p className="mt-2 text-sm text-ink-tertiary">
          Šampion, vicešampion, 3. mesto, MVP, najbolji strelac, pobednik prečke bosom nogom, tim
          turnira. CRUD forma stiže uz statistike kada budu spremni podaci iz utakmica.
        </p>
      </section>

      <LotteryBoardEditor tournamentId={active.id} prizes={prizes} createdBy={uid} />
    </section>
  );
}
