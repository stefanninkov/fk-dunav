import { useEffect, useRef } from 'react';
import gsap from 'gsap';

import { useUIStore } from '@/stores/useUIStore';

/**
 * Animates a score element whenever the `score` value changes. Pops the
 * number (scale 1 → 1.25 → 1), pulses a brand glow via box-shadow, and
 * plays the goal ping if the sound preference is enabled and the user
 * hasn't opted into reduced motion.
 */
export function useScorePop(score: number): React.RefObject<HTMLSpanElement | null> {
  const ref = useRef<HTMLSpanElement | null>(null);
  const firstRun = useRef(true);
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const reducedMotion = useUIStore((s) => s.reducedMotion);

  useEffect(() => {
    // Skip the initial mount — we only animate real score changes.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;

    if (!reducedMotion) {
      gsap.fromTo(
        el,
        { scale: 1 },
        {
          scale: 1.25,
          duration: 0.2,
          ease: 'back.out(1.7)',
          yoyo: true,
          repeat: 1,
          onComplete: () => gsap.set(el, { clearProps: 'scale,willChange' }),
        },
      );
    }

    if (soundEnabled) {
      // Try OGG first (smaller + open), fall back to MP3. Whichever file
      // the user commits at /public/assets/goal-ping.{ogg,mp3} will play;
      // if neither exists or autoplay is blocked, the catch keeps it silent.
      const base = `${import.meta.env.BASE_URL}assets/goal-ping`;
      const audio = new Audio();
      audio.volume = 0.4;
      audio.src = `${base}.ogg`;
      audio.play().catch(() => {
        audio.src = `${base}.mp3`;
        audio.play().catch(() => {
          /* both missing or autoplay blocked — silent */
        });
      });
    }
  }, [score, soundEnabled, reducedMotion]);

  return ref;
}
