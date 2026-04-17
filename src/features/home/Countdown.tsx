import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

import { useUIStore } from '@/stores/useUIStore';

interface Props {
  target: Date;
}

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function diffParts(target: Date, now: Date): Parts {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  return { days, hours, minutes, seconds };
}

/**
 * Ticking four-unit countdown. Each tile only re-animates when its own
 * number changes — seconds flip every tick, minutes once per minute, and
 * so on — so the hero isn't constantly flashing. Respects
 * prefers-reduced-motion via the UI store.
 */
export function Countdown({ target }: Props) {
  const [parts, setParts] = useState<Parts>(() => diffParts(target, new Date()));
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setParts(diffParts(target, new Date()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  // Initial intro — each tile rises into place in sequence.
  const reducedMotion = useUIStore((s) => s.reducedMotion);
  useEffect(() => {
    if (!rootRef.current || reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-tile]', {
        y: '0.75rem',
        opacity: 0,
        stagger: 0.08,
        duration: 0.5,
        ease: 'power2.out',
      });
    }, rootRef);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div
      ref={rootRef}
      className="flex items-end gap-2 sm:gap-3"
      aria-label="Odbrojavanje do početka turnira"
    >
      <Tile value={parts.days} label="dana" />
      <Sep />
      <Tile value={parts.hours} label="sati" pad />
      <Sep />
      <Tile value={parts.minutes} label="minuta" pad />
      <Sep />
      <Tile value={parts.seconds} label="sek" pad />
    </div>
  );
}

function Sep() {
  return (
    <span className="mb-5 font-display text-2xl font-700 text-ink-tertiary sm:text-3xl" aria-hidden>
      :
    </span>
  );
}

function Tile({ value, label, pad }: { value: number; label: string; pad?: boolean }) {
  const numberRef = useRef<HTMLSpanElement | null>(null);
  const prev = useRef<number | null>(null);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  useEffect(() => {
    const el = numberRef.current;
    if (!el) return;
    if (prev.current === null) {
      prev.current = value;
      return;
    }
    if (prev.current === value) return;
    prev.current = value;

    if (reducedMotion) return;

    // Flip-in: the new number briefly rises from the bottom and fades in,
    // so changing digits feel alive without being distracting.
    gsap.fromTo(
      el,
      { y: '0.35rem', opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.28,
        ease: 'power2.out',
        onComplete: () => gsap.set(el, { clearProps: 'y,opacity,willChange' }),
      },
    );
  }, [value, reducedMotion]);

  const display = pad ? String(value).padStart(2, '0') : String(value);

  return (
    <div
      data-tile
      className="flex flex-col items-center rounded-lg bg-surface-1 px-3 py-3 shadow-card sm:px-5"
    >
      <span
        ref={numberRef}
        className="tnum font-display text-3xl font-700 leading-none text-ink-primary sm:text-4xl"
      >
        {display}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-ink-tertiary sm:text-xs">
        {label}
      </span>
    </div>
  );
}
