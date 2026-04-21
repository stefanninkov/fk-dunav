import { useEffect, useRef } from 'react';
import gsap from 'gsap';

import type { LotteryPrize } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useUIStore } from '@/stores/useUIStore';

interface Props {
  prizes: LotteryPrize[];
  /** Bigger rows for the `/lutrija` big-screen view. */
  variant?: 'default' | 'big';
  /** Only show prizes that already have a winner drawn. */
  onlyDrawn?: boolean;
}

/**
 * Prize list. With `onlyDrawn=false` (default) every prize renders — drawn
 * prizes show the winner, pending ones show "Čeka se izvlačenje" so the
 * public can see the full prize line-up ahead of time.
 */
export function LotteryBoard({ prizes, variant = 'default', onlyDrawn = false }: Props) {
  const visible = onlyDrawn ? prizes.filter((p) => !!p.winnerName) : prizes;

  if (visible.length === 0) {
    return (
      <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">
        {sr.side.lottery.empty}
      </p>
    );
  }

  return (
    <ul className={`flex flex-col ${variant === 'big' ? 'gap-4' : 'gap-2'}`}>
      {visible.map((p, idx) => (
        <PrizeRow key={p.id} prize={p} index={idx} variant={variant} />
      ))}
    </ul>
  );
}

function PrizeRow({
  prize,
  index,
  variant,
}: {
  prize: LotteryPrize;
  index: number;
  variant: 'default' | 'big';
}) {
  const ref = useRef<HTMLLIElement | null>(null);
  const firstRun = useRef(true);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  // Subtle mount pop — mainly so newly drawn prizes arriving over onSnapshot
  // don't just blink in. The big-screen /lutrija view layers a name-shuffle
  // animation on top via its own dedicated page.
  useEffect(() => {
    if (!firstRun.current) return;
    firstRun.current = false;
    const el = ref.current;
    if (!el || reducedMotion) return;

    gsap.fromTo(
      el,
      { y: '1rem', opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
        onComplete: () => gsap.set(el, { clearProps: 'y,opacity,willChange' }),
      },
    );
  }, [reducedMotion]);

  const big = variant === 'big';
  const badgeSize = big ? 'h-14 w-14 text-xl' : 'h-10 w-10';
  const padding = big ? 'px-6 py-5' : 'px-4 py-3';
  const labelSize = big ? 'text-2xl' : 'text-base';
  const winnerSize = big ? 'text-xl' : 'text-sm';
  const drawn = !!prize.winnerName;

  return (
    <li
      ref={ref}
      className={`flex items-center gap-4 rounded-lg shadow-card ${padding} ${
        drawn ? 'bg-surface-1' : 'bg-surface-1/60'
      }`}
    >
      <span
        data-badge
        className={`flex shrink-0 items-center justify-center rounded-full font-display font-700 ${badgeSize}`}
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
        <span className={`font-500 text-ink-primary ${labelSize}`}>{prize.label}</span>
        <span
          className={`${winnerSize} ${drawn ? 'text-ink-secondary' : 'italic text-ink-tertiary'}`}
        >
          {drawn ? prize.winnerName : sr.side.lottery.pending}
        </span>
      </div>
    </li>
  );
}
