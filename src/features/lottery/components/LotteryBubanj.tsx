import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';

import { useUIStore } from '@/stores/useUIStore';

interface Props {
  /** Total raffle slip count (pool is 1..count). */
  count: number;
  /** True while a name-shuffle is actively running on a prize row. */
  spinningFast?: boolean;
  /** Set when a prize just resolved to a winner — triggers the fly-out + confetti. */
  lastWinnerNumber?: number | null;
}

/**
 * Numbered lottery drum. Visual-only — the authoritative draw happens
 * server-side via drawLotteryWinner(). Renders up to MAX_VISIBLE balls
 * orbiting inside the drum; pool sizes above that show a subset so the
 * scene stays readable, but the center label always shows the true total.
 *
 * When `lastWinnerNumber` changes the matching ball (or the nearest
 * visible proxy) breaks orbit, flies to a pedestal below the drum, and
 * triggers a confetti burst.
 */
const MAX_VISIBLE = 36;

export function LotteryBubanj({
  count,
  spinningFast = false,
  lastWinnerNumber = null,
}: Props) {
  const drumRef = useRef<HTMLDivElement | null>(null);
  const wobbleRef = useRef<HTMLDivElement | null>(null);
  const particleLayerRef = useRef<HTMLDivElement | null>(null);
  const ballRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const winnerPedestalRef = useRef<HTMLDivElement | null>(null);
  const confettiLayerRef = useRef<HTMLDivElement | null>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const wobbleTweenRef = useRef<gsap.core.Tween | null>(null);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const [lockedWinner, setLockedWinner] = useState<number | null>(null);

  // --- Which numbers to actually render as orbit chips ---------------------
  // If the pool is small (<= MAX_VISIBLE) show everything; otherwise show
  // a sampled subset at even stride so the scene feels representative
  // without bogging down the DOM / GSAP.
  const visibleNumbers = useMemo(() => {
    if (count <= 0) return [] as number[];
    if (count <= MAX_VISIBLE) {
      return Array.from({ length: count }, (_, i) => i + 1);
    }
    const stride = count / MAX_VISIBLE;
    return Array.from({ length: MAX_VISIBLE }, (_, i) =>
      Math.min(count, Math.max(1, Math.round((i + 0.5) * stride))),
    );
  }, [count]);

  // Seeds per visible number for orbit radius, phase, color.
  const orbits = useMemo(
    () =>
      visibleNumbers.map((n, i) => {
        const seed = hashNumber(n);
        const radiusRem = 4 + (seed % 500) / 100; // 4rem – 9rem
        const baseAngle = (360 / visibleNumbers.length) * i + (seed % 20);
        const phaseSec = (seed % 700) / 100;
        const orbitSec = 8 + (seed % 900) / 100;
        const wobbleSec = 2 + (seed % 300) / 100;
        const hue = 28 + (seed % 60);
        return { n, radiusRem, baseAngle, phaseSec, orbitSec, wobbleSec, hue };
      }),
    [visibleNumbers],
  );

  // --- Drum rotation + wobble ----------------------------------------------
  useEffect(() => {
    if (reducedMotion) return;
    spinTweenRef.current?.kill();
    wobbleTweenRef.current?.kill();

    const drum = drumRef.current;
    const wobble = wobbleRef.current;
    if (drum) {
      spinTweenRef.current = gsap.to(drum, {
        rotation: '+=360',
        duration: 18,
        ease: 'none',
        repeat: -1,
      });
    }
    if (wobble) {
      wobbleTweenRef.current = gsap.to(wobble, {
        rotation: 3.5,
        duration: 3.1,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }
    return () => {
      spinTweenRef.current?.kill();
      wobbleTweenRef.current?.kill();
    };
  }, [reducedMotion]);

  // Retune tempo on draw.
  useEffect(() => {
    const t = spinTweenRef.current;
    if (t) t.duration(spinningFast ? 2.2 : 18);
    const w = wobbleTweenRef.current;
    if (w) w.duration(spinningFast ? 1.5 : 3.1);
  }, [spinningFast]);

  // --- Per-ball orbits ------------------------------------------------------
  useEffect(() => {
    if (reducedMotion) return;
    const tweens: gsap.core.Tween[] = [];
    for (const { n, baseAngle, phaseSec, orbitSec, wobbleSec } of orbits) {
      const el = ballRefs.current.get(n);
      if (!el) continue;
      gsap.set(el, { ['--angle' as string]: `${baseAngle}deg`, ['--wobble' as string]: '0rem' });
      tweens.push(
        gsap.to(el, {
          ['--angle' as string]: `${baseAngle + 360}deg`,
          duration: orbitSec,
          ease: 'none',
          repeat: -1,
          delay: -phaseSec,
        }),
      );
      tweens.push(
        gsap.to(el, {
          ['--wobble' as string]: '0.45rem',
          duration: wobbleSec,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        }),
      );
    }
    return () => tweens.forEach((t) => t.kill());
  }, [orbits, reducedMotion]);

  // --- Sparks ---------------------------------------------------------------
  useEffect(() => {
    if (reducedMotion) return;
    const layer = particleLayerRef.current;
    if (!layer) return;
    const sparks: HTMLSpanElement[] = [];
    const tweens: gsap.core.Tween[] = [];
    const total = 24;
    for (let i = 0; i < total; i++) {
      const s = document.createElement('span');
      s.className = 'pointer-events-none absolute rounded-full';
      const size = 0.2 + Math.random() * 0.5;
      s.style.width = `${size}rem`;
      s.style.height = `${size}rem`;
      s.style.background =
        Math.random() < 0.5
          ? 'var(--color-accent-gold)'
          : 'rgba(255, 230, 150, 0.9)';
      s.style.boxShadow = '0 0 0.5rem rgba(244, 197, 66, 0.6)';
      s.style.opacity = `${0.4 + Math.random() * 0.4}`;
      layer.appendChild(s);
      sparks.push(s);

      gsap.set(s, {
        x: gsap.utils.random(-280, 280),
        y: gsap.utils.random(-260, 260),
      });
      tweens.push(
        gsap.to(s, {
          x: gsap.utils.random(-320, 320),
          y: gsap.utils.random(-300, 300),
          duration: 6 + Math.random() * 6,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        }),
      );
      tweens.push(
        gsap.to(s, {
          opacity: 0.2,
          duration: 1.5 + Math.random() * 2,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        }),
      );
    }
    return () => {
      tweens.forEach((t) => t.kill());
      sparks.forEach((s) => s.remove());
    };
  }, [reducedMotion]);

  // --- Fly-out + confetti on winner change ---------------------------------
  useEffect(() => {
    if (lastWinnerNumber == null || lastWinnerNumber === lockedWinner) return;
    setLockedWinner(lastWinnerNumber);
    if (reducedMotion) return;

    // Find the orbiting ball whose label matches; if the winning number
    // isn't in the sampled subset, grab the visually closest one.
    let ballKey: number | null = null;
    if (ballRefs.current.has(lastWinnerNumber)) {
      ballKey = lastWinnerNumber;
    } else {
      let best = Infinity;
      for (const n of ballRefs.current.keys()) {
        const d = Math.abs(n - lastWinnerNumber);
        if (d < best) {
          best = d;
          ballKey = n;
        }
      }
    }
    const ball = ballKey !== null ? ballRefs.current.get(ballKey) : null;
    const pedestal = winnerPedestalRef.current;
    const confettiLayer = confettiLayerRef.current;

    if (ball && pedestal) {
      const ballBox = ball.getBoundingClientRect();
      const pedBox = pedestal.getBoundingClientRect();
      const dx = pedBox.left + pedBox.width / 2 - (ballBox.left + ballBox.width / 2);
      const dy = pedBox.top + pedBox.height / 2 - (ballBox.top + ballBox.height / 2);
      gsap.to(ball, {
        x: dx,
        y: dy,
        scale: 1.4,
        zIndex: 50,
        duration: 1.1,
        ease: 'power3.inOut',
        onComplete: () => {
          gsap.to(ball, {
            scale: 1,
            duration: 0.5,
            ease: 'back.out(1.6)',
          });
        },
      });
      gsap.fromTo(
        pedestal,
        { scale: 0.9, opacity: 0.7 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.6,
          ease: 'back.out(2)',
          delay: 1,
        },
      );
    }

    if (confettiLayer) {
      const pieces = 48;
      for (let i = 0; i < pieces; i++) {
        const p = document.createElement('span');
        p.className = 'pointer-events-none absolute top-1/2 left-1/2';
        const size = 0.35 + Math.random() * 0.5;
        p.style.width = `${size}rem`;
        p.style.height = `${size * 0.35}rem`;
        const hue = 20 + Math.random() * 60;
        p.style.background = `hsl(${hue}, 90%, ${55 + Math.random() * 20}%)`;
        p.style.borderRadius = '0.15rem';
        p.style.transform = 'translate(-50%, -50%)';
        confettiLayer.appendChild(p);
        const angle = Math.random() * Math.PI * 2;
        const dist = 140 + Math.random() * 260;
        gsap.to(p, {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist + 60,
          rotation: Math.random() * 720 - 360,
          opacity: 0,
          duration: 1.2 + Math.random() * 0.8,
          ease: 'power2.out',
          onComplete: () => p.remove(),
        });
      }
    }
  }, [lastWinnerNumber, lockedWinner, reducedMotion]);

  if (count <= 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-full border-2 border-dashed border-surface-4 text-sm italic text-ink-tertiary">
        Čeka se broj učesnika…
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-6">
      <div
        className="relative flex items-center justify-center"
        style={{ width: '32rem', maxWidth: '100%', height: '32rem' }}
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(244,197,66,0.22) 0%, rgba(1,69,142,0.25) 45%, transparent 70%)',
            filter: 'blur(1.5rem)',
          }}
        />

        <div
          ref={particleLayerRef}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ willChange: 'transform' }}
        />

        <div ref={wobbleRef} className="relative h-full w-full">
          <div
            ref={drumRef}
            className="absolute inset-8 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 35% 25%, rgba(244,197,66,0.15) 0%, rgba(14,30,58,0.95) 35%, rgba(1,69,142,0.7) 75%, rgba(1,69,142,0.4) 100%)',
              border: '4px solid var(--color-accent-gold)',
              boxShadow:
                '0 0 0 2px rgba(244,197,66,0.3), 0 0 3rem rgba(244,197,66,0.35), inset 0 0 4rem rgba(0,0,0,0.55)',
              willChange: 'transform',
            }}
          >
            <div
              className="absolute inset-0 rounded-full opacity-40"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(255,255,255,0.12), transparent 10%, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%, transparent 90%, rgba(255,255,255,0.12))',
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: '55%',
                height: '55%',
                background:
                  'radial-gradient(circle, rgba(10,22,48,0.88) 0%, rgba(10,22,48,0.6) 60%, transparent 100%)',
                boxShadow: 'inset 0 0 2rem rgba(0,0,0,0.7)',
              }}
            />
          </div>

          {orbits.map(({ n, hue }) => (
            <div
              key={n}
              ref={(el) => {
                if (el) ballRefs.current.set(n, el);
                else ballRefs.current.delete(n);
              }}
              className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full font-display text-sm font-700 tabular-nums"
              style={
                {
                  '--angle': '0deg',
                  '--wobble': '0rem',
                  width: '2.4rem',
                  height: '2.4rem',
                  marginLeft: '-1.2rem',
                  marginTop: '-1.2rem',
                  background: `radial-gradient(circle at 35% 30%, hsl(${hue}, 95%, 78%) 0%, hsl(${hue}, 85%, 52%) 55%, hsl(${hue}, 90%, 32%) 100%)`,
                  boxShadow:
                    '0 0 0 1px rgba(0,0,0,0.4), 0 0.4rem 0.6rem rgba(0,0,0,0.45), inset -0.15rem -0.2rem 0.3rem rgba(0,0,0,0.4), inset 0.15rem 0.2rem 0.25rem rgba(255,255,255,0.45)',
                  color: '#211105',
                  transform:
                    'translate(calc(cos(var(--angle)) * 9rem + var(--wobble)), calc(sin(var(--angle)) * 9rem)) rotate(calc(var(--angle) * -1))',
                  willChange: 'transform',
                } as React.CSSProperties
              }
              title={`Broj ${n}`}
            >
              {n}
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute flex flex-col items-center gap-1 text-center">
          <span className="font-display text-[0.65rem] uppercase tracking-[0.4em] text-accent-gold">
            bubanj
          </span>
          <span className="tnum font-display text-4xl font-700 text-ink-primary drop-shadow-[0_0_0.5rem_rgba(244,197,66,0.4)]">
            {count}
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-ink-tertiary">
            listića
          </span>
        </div>

        <div
          ref={confettiLayerRef}
          className="pointer-events-none absolute inset-0 overflow-visible"
        />
      </div>

      {lockedWinner !== null ? (
        <div
          ref={winnerPedestalRef}
          className="flex flex-col items-center gap-1 rounded-2xl px-6 py-4 shadow-elevated"
          style={{
            background:
              'linear-gradient(180deg, rgba(244,197,66,0.95) 0%, rgba(205,155,32,0.95) 100%)',
            color: 'var(--color-ink-inverse)',
          }}
        >
          <span className="text-[0.6rem] uppercase tracking-[0.3em] opacity-80">
            poslednji dobitni broj
          </span>
          <span className="tnum font-display text-4xl font-700">{lockedWinner}</span>
        </div>
      ) : null}
    </div>
  );
}

function hashNumber(n: number): number {
  // djb2-ish for a small integer; good enough to decorrelate seeds.
  let h = 5381;
  const s = String(n);
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}
