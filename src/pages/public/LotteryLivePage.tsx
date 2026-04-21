import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { onSnapshot, orderBy, query } from 'firebase/firestore';

import {
  lotteryCol,
  lotteryParticipantsCol,
  lotterySessionDoc,
} from '@/lib/firestore/refs';
import type {
  LotteryParticipant,
  LotteryPrize,
  LotterySession,
} from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { useUIStore } from '@/stores/useUIStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { LotteryBubanj } from '@/features/lottery/components/LotteryBubanj';

/**
 * Public Lutrija page. Runs under the normal site layout (header + footer)
 * so it shows up as a regular tab; also renders well in fullscreen on a
 * projector for the live draw.
 *
 * Reveals the bubanj once admin flips `lotterySession.current.drumVisible`.
 * Watches for new winners on each prize and runs the shuffle-to-settle
 * animation on the corresponding row + passes the winner name down to the
 * bubanj to trigger the fly-out + confetti.
 */
export function LotteryLivePage() {
  const active = useTournamentStore((s) => s.active);
  const [prizes, setPrizes] = useState<LotteryPrize[]>([]);
  const [participants, setParticipants] = useState<LotteryParticipant[]>([]);
  const [session, setSession] = useState<LotterySession | null>(null);
  const [shufflingPrizeId, setShufflingPrizeId] = useState<string | null>(null);
  const [lastWinnerName, setLastWinnerName] = useState<string | null>(null);

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
    const unsubSession = onSnapshot(lotterySessionDoc(active.id), (snap) =>
      setSession(snap.exists() ? snap.data() : null),
    );
    return () => {
      unsubPrizes();
      unsubParticipants();
      unsubSession();
    };
  }, [active]);

  const drumVisible = session?.drumVisible ?? false;
  const drawnCount = prizes.filter((p) => !!p.winnerName).length;

  if (!active) {
    return <PagePlaceholder title={sr.side.lottery.title} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="relative overflow-hidden">
      {/* Background glow when drum is live */}
      {drumVisible ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center top, rgba(244,197,66,0.10) 0%, transparent 55%), radial-gradient(ellipse at center bottom, rgba(1,69,142,0.25) 0%, transparent 60%)',
          }}
        />
      ) : null}

      <div className="relative mx-auto flex max-w-[1100px] flex-col items-center gap-10 px-page-x py-12 lg:px-page-x-lg">
        <header className="flex flex-col items-center gap-2 text-center">
          <span className="text-[0.65rem] uppercase tracking-[0.3em] text-ink-tertiary">
            {sr.brand.name}
          </span>
          <h1 className="font-display text-4xl font-700 text-ink-primary sm:text-5xl">
            {sr.side.lottery.title}
          </h1>
          <p className="text-sm text-ink-secondary">{sr.side.lottery.subtitle}</p>
        </header>

        {drumVisible ? (
          <LotteryBubanj
            participants={participants}
            spinningFast={!!shufflingPrizeId}
            lastWinnerName={lastWinnerName}
          />
        ) : (
          <div className="w-full rounded-xl bg-surface-1 px-6 py-10 text-center shadow-card">
            <p className="text-base text-ink-secondary">
              Izvlačenje još nije počelo.
            </p>
            <p className="mt-1 text-xs text-ink-tertiary">
              Bubanj će se pojaviti kada admin otvori sesiju.
            </p>
          </div>
        )}

        <div className="w-full">
          {prizes.length === 0 ? (
            <div className="rounded-lg bg-surface-1 p-8 text-center text-sm text-ink-tertiary shadow-elevated">
              Lista nagrada se priprema…
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {prizes.map((p, idx) => (
                <PrizeRow
                  key={p.id}
                  prize={p}
                  index={idx}
                  participants={participants}
                  onShuffleStart={() => setShufflingPrizeId(p.id)}
                  onShuffleEnd={(winner) => {
                    setShufflingPrizeId((curr) => (curr === p.id ? null : curr));
                    setLastWinnerName(winner);
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        {prizes.length > 0 ? (
          <p className="tnum text-xs uppercase tracking-[0.3em] text-ink-tertiary">
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
  onShuffleStart,
  onShuffleEnd,
}: {
  prize: LotteryPrize;
  index: number;
  participants: LotteryParticipant[];
  onShuffleStart: () => void;
  onShuffleEnd: (winnerName: string) => void;
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
      setDisplayName(currentWinner);
      setPhase('settled');
      return;
    }

    if (reducedMotion || poolRef.current.length === 0) {
      setDisplayName(currentWinner);
      setPhase('settled');
      onShuffleEnd(currentWinner);
      return;
    }

    setPhase('shuffling');
    onShuffleStart();
    const startedAt = Date.now();
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= SHUFFLE_DURATION_MS) {
        setDisplayName(currentWinner);
        setPhase('settled');
        onShuffleEnd(currentWinner);
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
      const curr = poolRef.current;
      if (curr.length > 0) {
        const pick = curr[Math.floor(Math.random() * curr.length)];
        setDisplayName(pick);
      }
      window.setTimeout(tick, SHUFFLE_STEP_MS);
    };
    tick();

    return () => {
      cancelled = true;
    };
  }, [prize.winnerName, reducedMotion, onShuffleStart, onShuffleEnd]);

  const drawn = phase === 'settled';

  return (
    <li
      ref={rowRef}
      className={`flex items-center gap-5 rounded-xl px-6 py-5 shadow-card ${
        drawn
          ? 'bg-surface-1'
          : phase === 'shuffling'
            ? 'bg-brand-900/60'
            : 'bg-surface-1/70'
      }`}
    >
      <span
        ref={badgeRef}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-700"
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
        <span className="font-display text-xl font-500 text-ink-primary">{prize.label}</span>
        <span
          className={`mt-1 font-display text-lg ${
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
