import { useEffect, useRef } from 'react';
import gsap from 'gsap';

import type { LotteryPrize } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useUIStore } from '@/stores/useUIStore';

interface Props {
  prizes: LotteryPrize[];
  /** Hide every prize that hasn't been revealed yet. Default true — the
   *  admin editor passes `false` to show everything for management. */
  onlyRevealed?: boolean;
  /** Bigger rows for the `/lutrija` big-screen view. */
  variant?: 'default' | 'big';
}

export function LotteryBoard({
  prizes,
  onlyRevealed = true,
  variant = 'default',
}: Props) {
  const visible = onlyRevealed ? prizes.filter((p) => p.revealed) : prizes;

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

  // Celebration animation when a prize flips from hidden to revealed.
  // We can't observe the boolean flip directly from a memo list, so we
  // animate once on mount when `revealed` is true — that covers newly
  // arriving rows in the Firestore onSnapshot stream.
  useEffect(() => {
    if (!firstRun.current) return;
    firstRun.current = false;
    const el = ref.current;
    if (!el || reducedMotion) return;

    gsap.fromTo(
      el,
      { y: '1.5rem', opacity: 0, scale: 0.96 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.6,
        ease: 'back.out(1.6)',
        onComplete: () => gsap.set(el, { clearProps: 'y,opacity,scale,willChange' }),
      },
    );
    // Briefly flash a glow on the ordinal badge.
    const badge = el.querySelector<HTMLElement>('[data-badge]');
    if (badge) {
      gsap.fromTo(
        badge,
        { boxShadow: '0 0 0 rgba(1,69,142,0)' },
        {
          boxShadow: '0 0 40px rgba(244,197,66,0.65)',
          duration: 0.8,
          yoyo: true,
          repeat: 1,
        },
      );
    }
  }, [reducedMotion]);

  const big = variant === 'big';
  const badgeSize = big ? 'h-14 w-14 text-xl' : 'h-10 w-10';
  const padding = big ? 'px-6 py-5' : 'px-4 py-3';
  const labelSize = big ? 'text-2xl' : 'text-base';
  const winnerSize = big ? 'text-xl' : 'text-sm';
  const photoSize = big ? 'h-14 w-14' : 'h-10 w-10';

  return (
    <li
      ref={ref}
      className={`flex items-center gap-4 rounded-lg bg-surface-1 shadow-card ${padding}`}
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
        <span className={`text-ink-secondary ${winnerSize}`}>{prize.winnerName}</span>
      </div>
      {prize.winnerPhotoUrl ? (
        <img
          src={prize.winnerPhotoUrl}
          alt={prize.winnerName}
          className={`${photoSize} rounded-full object-cover`}
        />
      ) : null}
    </li>
  );
}
