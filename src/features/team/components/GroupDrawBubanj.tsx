import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';

import type { Group, GroupDrawSession, Team } from '@/lib/firestore/types';
import { useUIStore } from '@/stores/useUIStore';

interface Props {
  groups: Group[];
  teams: Team[];
  session: GroupDrawSession | null;
}

/**
 * Public-facing drum for the group draw. Orbits the names of unassigned
 * teams inside a gold-rimmed bubanj and, whenever the session records a
 * new draw (lastDrawnTeamId changes), shuffles names then flies the
 * winning team chip into the destination group column below.
 */
export function GroupDrawBubanj({ groups, teams, session }: Props) {
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  const drumRef = useRef<HTMLDivElement | null>(null);
  const wobbleRef = useRef<HTMLDivElement | null>(null);
  const particleLayerRef = useRef<HTMLDivElement | null>(null);
  const ballRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const groupColumnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const confettiLayerRef = useRef<HTMLDivElement | null>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const wobbleTweenRef = useRef<gsap.core.Tween | null>(null);

  const [ackedDraw, setAckedDraw] = useState<string | null>(
    session?.lastDrawnTeamId ?? null,
  );
  const [spinningFast, setSpinningFast] = useState(false);

  const activeTeams = useMemo(() => teams.filter((t) => !t.deletedAt), [teams]);
  const pending = useMemo(
    () => activeTeams.filter((t) => !t.groupId),
    [activeTeams],
  );
  const assignedByGroup = useMemo(() => {
    const m = new Map<string, Team[]>();
    for (const g of groups) m.set(g.id, []);
    for (const t of activeTeams) {
      if (t.groupId) m.get(t.groupId)?.push(t);
    }
    return m;
  }, [groups, activeTeams]);

  // --- Ball seeds (stable per team id) --------------------------------------
  const orbits = useMemo(
    () =>
      pending.map((t, i) => {
        const seed = hashString(t.id);
        const baseAngle = (360 / Math.max(1, pending.length)) * i + (seed % 20);
        const phaseSec = (seed % 700) / 100;
        const orbitSec = 10 + (seed % 900) / 100;
        const wobbleSec = 2 + (seed % 300) / 100;
        const hue = 28 + (seed % 60);
        return { t, baseAngle, phaseSec, orbitSec, wobbleSec, hue };
      }),
    [pending],
  );

  // --- Drum rotation --------------------------------------------------------
  useEffect(() => {
    if (reducedMotion) return;
    spinTweenRef.current?.kill();
    wobbleTweenRef.current?.kill();
    const drum = drumRef.current;
    const wobble = wobbleRef.current;
    if (drum) {
      spinTweenRef.current = gsap.to(drum, {
        rotation: '+=360',
        duration: 20,
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

  useEffect(() => {
    const t = spinTweenRef.current;
    if (t) t.duration(spinningFast ? 2.2 : 20);
    const w = wobbleTweenRef.current;
    if (w) w.duration(spinningFast ? 1.5 : 3.1);
  }, [spinningFast]);

  // --- Per-ball orbits ------------------------------------------------------
  useEffect(() => {
    if (reducedMotion) return;
    const tweens: gsap.core.Tween[] = [];
    for (const { t, baseAngle, phaseSec, orbitSec, wobbleSec } of orbits) {
      const el = ballRefs.current.get(t.id);
      if (!el) continue;
      gsap.set(el, {
        ['--angle' as string]: `${baseAngle}deg`,
        ['--wobble' as string]: '0rem',
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
      });
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
    return () => tweens.forEach((tw) => tw.kill());
  }, [orbits, reducedMotion]);

  // --- Sparks ---------------------------------------------------------------
  useEffect(() => {
    if (reducedMotion) return;
    const layer = particleLayerRef.current;
    if (!layer) return;
    const sparks: HTMLSpanElement[] = [];
    const tweens: gsap.core.Tween[] = [];
    for (let i = 0; i < 20; i++) {
      const s = document.createElement('span');
      s.className = 'pointer-events-none absolute rounded-full';
      const size = 0.2 + Math.random() * 0.4;
      s.style.width = `${size}rem`;
      s.style.height = `${size}rem`;
      s.style.background =
        Math.random() < 0.5
          ? 'var(--color-accent-gold)'
          : 'rgba(255, 230, 150, 0.9)';
      s.style.boxShadow = '0 0 0.5rem rgba(244, 197, 66, 0.55)';
      s.style.opacity = `${0.3 + Math.random() * 0.4}`;
      layer.appendChild(s);
      sparks.push(s);
      gsap.set(s, {
        x: gsap.utils.random(-240, 240),
        y: gsap.utils.random(-220, 220),
      });
      tweens.push(
        gsap.to(s, {
          x: gsap.utils.random(-280, 280),
          y: gsap.utils.random(-260, 260),
          duration: 6 + Math.random() * 6,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        }),
      );
    }
    return () => {
      tweens.forEach((t) => t.kill());
      sparks.forEach((s) => s.remove());
    };
  }, [reducedMotion]);

  // --- Fly-out on new draw --------------------------------------------------
  useEffect(() => {
    const drawnId = session?.lastDrawnTeamId;
    const drawnGroupId = session?.lastDrawnGroupId;
    if (!drawnId || !drawnGroupId || drawnId === ackedDraw) return;
    setAckedDraw(drawnId);

    const ball = ballRefs.current.get(drawnId);
    const column = groupColumnRefs.current.get(drawnGroupId);
    const confetti = confettiLayerRef.current;

    if (reducedMotion) return;

    // Kick the drum into fast-spin for a short window.
    setSpinningFast(true);
    window.setTimeout(() => setSpinningFast(false), 2400);

    if (ball && column) {
      const ballBox = ball.getBoundingClientRect();
      const colBox = column.getBoundingClientRect();
      const dx =
        colBox.left + colBox.width / 2 - (ballBox.left + ballBox.width / 2);
      const dy = colBox.top + 32 - (ballBox.top + ballBox.height / 2);
      gsap.to(ball, {
        x: dx,
        y: dy,
        scale: 1.25,
        zIndex: 50,
        duration: 1.2,
        ease: 'power3.inOut',
        delay: 0.4,
        onComplete: () => {
          // Fade out — the next render will move the team from `pending`
          // to the group column organically so we don't keep the ball.
          gsap.to(ball, { opacity: 0, duration: 0.3, delay: 0.15 });
        },
      });
    }

    if (confetti) {
      const pieces = 40;
      for (let i = 0; i < pieces; i++) {
        const p = document.createElement('span');
        p.className = 'pointer-events-none absolute top-1/2 left-1/2';
        const size = 0.3 + Math.random() * 0.45;
        p.style.width = `${size}rem`;
        p.style.height = `${size * 0.35}rem`;
        const hue = 20 + Math.random() * 60;
        p.style.background = `hsl(${hue}, 90%, ${55 + Math.random() * 20}%)`;
        p.style.borderRadius = '0.15rem';
        p.style.transform = 'translate(-50%, -50%)';
        confetti.appendChild(p);
        const angle = Math.random() * Math.PI * 2;
        const dist = 120 + Math.random() * 220;
        gsap.to(p, {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist + 50,
          rotation: Math.random() * 720 - 360,
          opacity: 0,
          duration: 1.2 + Math.random() * 0.8,
          ease: 'power2.out',
          delay: 1.2,
          onComplete: () => p.remove(),
        });
      }
    }
  }, [session?.lastDrawnTeamId, session?.lastDrawnGroupId, ackedDraw, reducedMotion]);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Drum scene */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: '28rem', maxWidth: '100%', height: '28rem' }}
      >
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
        />
        <div ref={wobbleRef} className="relative h-full w-full">
          <div
            ref={drumRef}
            className="absolute inset-6 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 35% 25%, rgba(244,197,66,0.15) 0%, rgba(14,30,58,0.95) 35%, rgba(1,69,142,0.7) 75%, rgba(1,69,142,0.4) 100%)',
              border: '4px solid var(--color-accent-gold)',
              boxShadow:
                '0 0 0 2px rgba(244,197,66,0.3), 0 0 3rem rgba(244,197,66,0.3), inset 0 0 4rem rgba(0,0,0,0.5)',
            }}
          >
            <div
              className="absolute inset-0 rounded-full opacity-40"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(255,255,255,0.1), transparent 10%, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%, transparent 90%, rgba(255,255,255,0.1))',
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

          {orbits.map(({ t, hue }) => (
            <div
              key={t.id}
              ref={(el) => {
                if (el) ballRefs.current.set(t.id, el);
                else ballRefs.current.delete(t.id);
              }}
              className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full text-[0.65rem] font-700 uppercase tracking-tight"
              style={
                {
                  '--angle': '0deg',
                  '--wobble': '0rem',
                  width: '3rem',
                  height: '3rem',
                  marginLeft: '-1.5rem',
                  marginTop: '-1.5rem',
                  background: `radial-gradient(circle at 35% 30%, hsl(${hue}, 95%, 78%) 0%, hsl(${hue}, 85%, 52%) 55%, hsl(${hue}, 90%, 32%) 100%)`,
                  boxShadow:
                    '0 0 0 1px rgba(0,0,0,0.4), 0 0.4rem 0.6rem rgba(0,0,0,0.4), inset -0.15rem -0.2rem 0.3rem rgba(0,0,0,0.35), inset 0.15rem 0.2rem 0.25rem rgba(255,255,255,0.4)',
                  color: '#211105',
                  transform:
                    'translate(calc(cos(var(--angle)) * 7.5rem + var(--wobble)), calc(sin(var(--angle)) * 7.5rem)) rotate(calc(var(--angle) * -1))',
                  willChange: 'transform, opacity',
                } as React.CSSProperties
              }
              title={t.name}
            >
              <span className="max-w-[2.4rem] truncate px-1 text-center">
                {t.shortName ?? shortenTeamName(t.name)}
              </span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute flex flex-col items-center gap-1 text-center">
          <span className="font-display text-[0.65rem] uppercase tracking-[0.4em] text-accent-gold">
            bubanj
          </span>
          <span className="tnum font-display text-3xl font-700 text-ink-primary drop-shadow-[0_0_0.5rem_rgba(244,197,66,0.4)]">
            {pending.length}
          </span>
          <span className="text-[0.6rem] uppercase tracking-[0.25em] text-ink-tertiary">
            timova čeka
          </span>
        </div>
        <div
          ref={confettiLayerRef}
          className="pointer-events-none absolute inset-0 overflow-visible"
        />
      </div>

      {/* Group columns */}
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {groups.map((g) => {
          const members = assignedByGroup.get(g.id) ?? [];
          return (
            <div
              key={g.id}
              ref={(el) => {
                if (el) groupColumnRefs.current.set(g.id, el);
                else groupColumnRefs.current.delete(g.id);
              }}
              className="flex flex-col gap-2 rounded-xl bg-surface-1 p-3 shadow-card"
            >
              <header className="flex items-center justify-between">
                <h3 className="font-display text-sm font-700 text-ink-primary">
                  {g.name}
                </h3>
                <span className="tnum text-xs text-ink-tertiary">
                  {members.length}
                </span>
              </header>
              <ul className="flex flex-col gap-1">
                {members.length === 0 ? (
                  <li className="rounded-md bg-surface-2 px-2 py-1 text-xs italic text-ink-tertiary">
                    —
                  </li>
                ) : (
                  members.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-md bg-surface-2 px-2 py-1 text-xs text-ink-primary"
                    >
                      {t.name}
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

function shortenTeamName(name: string): string {
  // Try to produce something < 4 chars. For "FK Dunav" → "FKD".
  const trimmed = name.trim();
  if (trimmed.length <= 4) return trimmed.toUpperCase();
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return parts
      .slice(0, 3)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }
  return trimmed.slice(0, 3).toUpperCase();
}
