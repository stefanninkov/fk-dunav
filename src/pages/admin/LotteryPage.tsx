import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Eye, EyeOff } from 'lucide-react';

import { lotteryCol, lotterySessionDoc } from '@/lib/firestore/refs';
import type { LotteryPrize, LotterySession } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { setLotteryDrumVisible } from '@/features/lottery/lotteryActions';
import { LotteryBoardEditor } from '@/features/lottery/components/LotteryBoardEditor';

/**
 * Standalone admin Lutrija page. Edits the raffle slip count + prize list +
 * drum visibility. The draw pool is simply integers 1..participantCount.
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

  const drumVisible = session?.drumVisible ?? false;
  const participantCount = session?.participantCount ?? 0;

  async function toggleDrum() {
    if (!active || !uid) return;
    await setLotteryDrumVisible(active.id, !drumVisible, uid);
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-700">{sr.side.lottery.title}</h1>
      </header>

      <div
        className={`flex flex-wrap items-center gap-4 rounded-lg p-4 shadow-card ${
          drumVisible ? 'bg-brand-900/50' : 'bg-surface-1'
        }`}
      >
        <div className="flex min-w-[12rem] flex-1 flex-col">
          <span className="font-display text-sm font-600 text-ink-primary">
            {drumVisible ? sr.admin.lottery.drumOn : sr.admin.lottery.drumOff}
          </span>
          <span className="text-xs text-ink-tertiary">
            {sr.admin.lottery.drumHelp}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void toggleDrum()}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-700 ${
            drumVisible
              ? 'border border-surface-4 text-ink-secondary hover:bg-surface-2'
              : 'bg-accent-gold text-ink-inverse hover:opacity-90'
          }`}
        >
          {drumVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          {drumVisible ? sr.admin.lottery.hideDrum : sr.admin.lottery.showDrum}
        </button>
      </div>

      <LotteryBoardEditor
        tournamentId={active.id}
        participantCount={participantCount}
        prizes={prizes}
        createdBy={uid}
      />
    </section>
  );
}
