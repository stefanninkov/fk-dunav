import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';

import type { LotteryParticipant } from '@/lib/firestore/types';
import { useUIStore } from '@/stores/useUIStore';

interface Props {
  participants: LotteryParticipant[];
  /** True while a name-shuffle is actively running on a prize row. */
  spinningFast?: boolean;
  /** Set when a prize just resolved to a winner; triggers the ball-fly-out + confetti. */
  lastWinnerName?: string | null;
}

/**
 * The lottery drum as theatre. Three layers:
 *
 *   1. A gold-rimmed navy drum body with a viewing window cut in the
 *      center. The drum rotates permanently on a slow orbit and speeds
 *      up during active draws; a subtle wobble keeps it from looking
 *      mechanical.
 *
 *   2. Participant "balls" (colored chips with the name on them) that
 *      tumble inside the drum on independent orbits at varying radii,
 *      giving a believable volumetric feel even though it's flat SVG.
 *      Each ball has a wobble of its own that desynchronizes from the
 *      drum's rotation — so the view never looks like a static ring.
 *
 *   3. A particle layer of sparks + gold flecks that floats around the
 *      drum and accelerates during draws.
 *
 * When `lastWinnerName` changes, one ball breaks orbit, flies down to a
 * winner pedestal below the drum, and triggers a GSAP confetti burst.
 */
export function LotteryBubanj({
  participants,
  spinningFast = false,
  lastWinnerName = null,
}: Props) {
  const drumRef = useRef<HTMLDivElement | null>(null);
  const wobbleRef = useRef<HTMLDivElement | null>(null);
  const particleLayerRef = useRef<HTMLDivElement | null>(null);
  const ballRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const winnerPedestalRef = useRef<HTMLDivElement | null>(null);
  const confettiLayerRef = useRef<HTMLDivElement | null>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const wobbleTweenRef = useRef<gsap.core.Tween | null>(null);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const [lockedWinner, setLockedWinner] = useState<string | null>(null);

  // --- Deterministic per-ball seed -----------------------------------------
  // Each ball needs its own orbit radius, phase, color, and wobble rate so
  // the scene doesn't feel lattice-y. Deriving those from the participant id
  // via a small hash keeps them stable across re-renders (no jump on updates)
  // and across clients (the same draw looks the same everywhere).
  const orbits = useMemo(
    () =>
      participants.map((p) => {
        const seed = hashString(p.id);
        const radiusRem = 4 + (seed % 500) / 100; // 4rem – 9rem
        const baseAngle = seed % 360;
        const phaseSec = (seed % 700) / 100; // 0 – 7 s stagger
        const orbitSec = 8 + (seed % 900) / 100; // 8 – 17 s per revolution
        const wobbleSec = 2 + (seed % 300) / 100; // 2 – 5 s
        const hue = 28 + (seed % 60); // gold -> amber band
        return { p, radiusRem, baseAngle, phaseSec, orbitSec, wobbleSec, hue };
      }),
    [participants],
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

  // Retune the spin duration on draw — no teardown, just faster/slower.
  useEffect(() => {
    const t = spinTweenRef.current;
    if (!t) return;
    t.duration(spinningFast ? 2.2 : 18);
    // Wobble intensifies a bit during draws for extra chaos.
    const w = wobbleTweenRef.current;
    if (w) w.duration(spinningFast ? 1.5 : 3.1);
  }, [spinningFast]);

  // --- Per-ball orbits (independent GSAP tweens on CSS vars) ---------------
  useEffect(() => {
    if (reducedMotion) return;
    const tweens: gsap.core.Tween[] = [];
    for (const { p, baseAngle, phaseSec, orbitSec, wobbleSec } of orbits) {
      const el = ballRefs.current.get(p.id);
      if (!el) continue;
      // Seed starting angle.
      gsap.set(el, { ['--angle' as string]: `${baseAngle}deg`, ['--wobble' as string]: '0rem' });
      tweens.push(
        gsap.to(el, {
          ['--angle' as string]: `${baseAngle + 360}deg`,
          duration: orbitSec,
          ease: 'none',
          repeat: -1,
          delay: -phaseSec, // negative delay = pre-seek
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

  // --- Sparks: render N particles with random long-duration drifts ---------
  useEffect(() => {
    if (reducedMotion) return;
    const layer = particleLayerRef.current;
    if (!layer) return;
    const sparks: HTMLSpanElement[] = [];
    const tweens: gsap.core.Tween[] = [];
    const count = 24;
    for (let i = 0; i < count; i++) {
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
      const driftX = gsap.utils.random(-320, 320);
      const driftY = gsap.utils.random(-300, 300);
      tweens.push(
        gsap.to(s, {
          x: driftX,
          y: driftY,
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
    if (!lastWinnerName || lastWinnerName === lockedWinner) return;
    setLockedWinner(lastWinnerName);
    if (reducedMotion) return;

    const matched = participants.find((p) => p.name === lastWinnerName);
    const ball = matched ? ballRefs.current.get(matched.id) : null;
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

    // Confetti burst.
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
          y: Math.sin(angle) * dist + 60, // gravity-ish downward bias
          rotation: Math.random() * 720 - 360,
          opacity: 0,
          duration: 1.2 + Math.random() * 0.8,
          ease: 'power2.out',
          onComplete: () => p.remove(),
        });
      }
    }
  }, [lastWinnerName, lockedWinner, participants, reducedMotion]);

  if (participants.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-full border-2 border-dashed border-surface-4 text-sm italic text-ink-tertiary">
        Čeka se lista učesnika…
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-6">
      {/* Scene */}
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

        {/* Sparks */}
        <div
          ref={particleLayerRef}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ willChange: 'transform' }}
        />

        {/* Wobble wrapper — parent of drum + balls */}
        <div ref={wobbleRef} className="relative h-full w-full">
          {/* Drum body */}
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
            {/* Drum texture: radial stripes evoking a rotating barrel */}
            <div
              className="absolute inset-0 rounded-full opacity-40"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(255,255,255,0.12), transparent 10%, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%, transparent 90%, rgba(255,255,255,0.12))',
              }}
            />
            {/* Central viewing window */}
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

          {/* Balls — positioned absolutely, each with its own orbit via CSS vars */}
          {orbits.map(({ p, hue }) => (
            <div
              key={p.id}
              ref={(el) => {
                if (el) ballRefs.current.set(p.id, el);
                else ballRefs.current.delete(p.id);
              }}
              className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full text-[0.6rem] font-700 tracking-tight"
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
                  // Orbit positioning via rotate/translate/rotate trick so
                  // the label stays upright while the drum spins.
                  transform:
                    'translate(calc(cos(var(--angle)) * 9rem + var(--wobble)), calc(sin(var(--angle)) * 9rem)) rotate(calc(var(--angle) * -1))',
                  willChange: 'transform',
                } as React.CSSProperties
              }
              title={p.name}
            >
              <span className="max-w-[2rem] truncate px-1 text-center">{p.name}</span>
            </div>
          ))}
        </div>

        {/* Center label */}
        <div className="pointer-events-none absolute flex flex-col items-center gap-1 text-center">
          <span className="font-display text-[0.65rem] uppercase tracking-[0.4em] text-accent-gold">
            bubanj
          </span>
          <span className="tnum font-display text-4xl font-700 text-ink-primary drop-shadow-[0_0_0.5rem_rgba(244,197,66,0.4)]">
            {participants.length}
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-ink-tertiary">
            učesnika
          </span>
        </div>

        {/* Confetti layer — covers whole scene */}
        <div
          ref={confettiLayerRef}
          className="pointer-events-none absolute inset-0 overflow-visible"
        />
      </div>

      {/* Winner pedestal — where a ball flies to when drawn. Reveals only
          after the first draw (keeps the layout balanced before). */}
      {lockedWinner ? (
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
            poslednji pobednik
          </span>
          <span className="font-display text-2xl font-700">{lockedWinner}</span>
        </div>
      ) : null}
    </div>
  );
}

// Small deterministic hash used for per-ball seeding. djb2.
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}
