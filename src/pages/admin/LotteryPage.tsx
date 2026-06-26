import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import { lotteryCol, lotterySessionDoc } from '@/lib/firestore/refs';
import type { LotteryPrize, LotterySession } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { LotteryBoardEditor } from '@/features/lottery/components/LotteryBoardEditor';

/**
 * Standalone admin Lutrija page. Edits the raffle slip count + prize
 * list + per-prize draws. The draw pool is simply integers
 * 1..participantCount.
 */
export function LotteryPage() {
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
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

  if (!active || !uid) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.side.lottery.title}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  const participantCount = session?.participantCount ?? 0;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-700">{sr.side.lottery.title}</h1>
      </header>

      <LotteryBoardEditor
        tournamentId={active.id}
        participantCount={participantCount}
        prizes={prizes}
        createdBy={uid}
      />
    </section>
  );
}
