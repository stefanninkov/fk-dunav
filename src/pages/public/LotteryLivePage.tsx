import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import logoUrl from '@/assets/logo.svg';
import { lotteryCol, lotteryParticipantsCol } from '@/lib/firestore/refs';
import type { LotteryParticipant, LotteryPrize } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { useUIStore } from '@/stores/useUIStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

/**
 * Big-screen "live draw" view for projectors / TVs at the venue. Renders the
 * full prize ladder with pending placeholders up front. When a prize flips
 * from undrawn to drawn (winner appears in Firestore), the corresponding row
 * runs a ~2.5s name-shuffle animation and settles on the real winner. All
 * admin-driven — no login required to view.
 */
export function LotteryLivePage() {
  const active = useTournamentStore((s) => s.active);
  const [prizes, setPrizes] = useState<LotteryPrize[]>([]);
  const [participants, setParticipants] = useState<LotteryParticipant[]>([]);

  useEffect(() => {
    if (!active) return;
    const unsubPrizes = onSnapshot(
      query(lotteryCol(active.id), orderBy('order', 'asc')),
      (snap) => setPrizes(snap.docs.map((d) => d.data())),
    );
    const unsubParticipants = onSnapshot(
      lotteryParticipantsCol(active.id),
      (snap) => setParticipants(snap.docs.map((d) => d.data())),
    );
    return () => {
      unsubPrizes();
      unsubParticipants();
    };
  }, [active]);

  const drawnCount = prizes.filter((p) => !!p.winnerName).length;

  if (!active) {
    return <PagePlaceholder title={sr.side.lottery.title} description="Čeka se aktivan turnir." />;
  }

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
          <p className="text-base text-ink-secondary">{sr.side.lottery.subtitle}</p>
        </header>

        <div className="w-full">
          {prizes.length === 0 ? (
            <div className="rounded-lg bg-surface-1 p-10 text-center text-base text-ink-tertiary shadow-elevated">
              Izvlačenje počinje uskoro…
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {prizes.map((p, idx) => (
                <PrizeRow
                  key={p.id}
                  prize={p}
                  index={idx}
                  participants={participants}
                />
              ))}
            </ul>
          )}
        </div>

        {prizes.length > 0 ? (
          <p className="tnum text-xs text-ink-tertiary">
            {drawnCount} / {prizes.length} izvučeno
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const SHUFFLE_DURATION_MS = 2500;
const SHUFFLE_STEP_MS = 70;

function PrizeRow({
  prize,
  index,
  participants,
}: {
  prize: LotteryPrize;
  index: number;
  participants: LotteryParticipant[];
}) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const hadWinnerRef = useRef<boolean>(!!prize.winnerName);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const [displayName, setDisplayName] = useState<string | null>(prize.winnerName ?? null);
  const [phase, setPhase] = useState<'idle' | 'shuffling' | 'settled'>(
    prize.winnerName ? 'settled' : 'idle',
  );

  const pool = useMemo(() => participants.map((p) => p.name), [participants]);
  const poolRef = useRef(pool);
  poolRef.current = pool;

  // Trigger shuffle when `winnerName` transitions from unset to set. We
  // intentionally skip the animation on the first mount for prizes that
  // were already drawn before this client connected — they just display.
  useEffect(() => {
    const currentWinner = prize.winnerName;
    const hadWinner = hadWinnerRef.current;
    hadWinnerRef.current = !!currentWinner;

    if (!currentWinner) {
      setDisplayName(null);
      setPhase('idle');
      return;
    }

    if (hadWinner) {
      // Already had a winner on last render — just keep it displayed.
      setDisplayName(currentWinner);
      setPhase('settled');
      return;
    }

    if (reducedMotion || poolRef.current.length === 0) {
      setDisplayName(currentWinner);
      setPhase('settled');
      return;
    }

    setPhase('shuffling');
    const startedAt = Date.now();
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= SHUFFLE_DURATION_MS) {
        setDisplayName(currentWinner);
        setPhase('settled');
        // Pop + glow on settle.
        const row = rowRef.current;
        const badge = badgeRef.current;
        if (row) {
          gsap.fromTo(
            row,
            { scale: 0.96 },
            {
              scale: 1,
              duration: 0.5,
              ease: 'back.out(1.8)',
              onComplete: () => gsap.set(row, { clearProps: 'scale,willChange' }),
            },
          );
        }
        if (badge) {
          gsap.fromTo(
            badge,
            { boxShadow: '0 0 0 rgba(244,197,66,0)' },
            {
              boxShadow: '0 0 48px rgba(244,197,66,0.75)',
              duration: 0.9,
              yoyo: true,
              repeat: 1,
            },
          );
        }
        return;
      }
      const pool = poolRef.current;
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        setDisplayName(pick);
      }
      window.setTimeout(tick, SHUFFLE_STEP_MS);
    };
    tick();

    return () => {
      cancelled = true;
    };
  }, [prize.winnerName, reducedMotion]);

  const drawn = phase === 'settled';

  return (
    <li
      ref={rowRef}
      className={`flex items-center gap-5 rounded-xl px-6 py-5 shadow-elevated ${
        drawn ? 'bg-surface-1' : phase === 'shuffling' ? 'bg-brand-900/60' : 'bg-surface-1/70'
      }`}
    >
      <span
        ref={badgeRef}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-xl font-700"
        style={{
          backgroundColor:
            index === 0
              ? 'var(--color-accent-gold)'
              : index === 1
                ? 'var(--color-accent-silver)'
                : index === 2
                  ? 'var(--color-accent-bronze)'
                  : 'var(--color-brand-600)',
          color: 'var(--color-ink-inverse)',
        }}
      >
        {index + 1}
      </span>
      <div className="flex flex-1 flex-col">
        <span className="font-display text-2xl font-500 text-ink-primary">{prize.label}</span>
        <span
          className={`mt-1 font-display text-xl ${
            phase === 'shuffling'
              ? 'font-700 text-accent-gold'
              : drawn
                ? 'font-600 text-ink-primary'
                : 'italic text-ink-tertiary'
          }`}
        >
          {displayName ?? sr.side.lottery.pending}
        </span>
      </div>
    </li>
  );
}
