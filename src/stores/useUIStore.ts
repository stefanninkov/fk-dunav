import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  soundEnabled: boolean;
  reducedMotion: boolean;
  mobileNavOpen: boolean;

  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

/**
 * UI preferences. Sound and reduced-motion preferences persist across
 * sessions via localStorage (the one exception to the CLAUDE.md "no
 * localStorage for app state" rule — these are device preferences, not
 * app data).
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      soundEnabled: false,
      reducedMotion: false,
      mobileNavOpen: false,

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
    }),
    {
      name: 'fk-dunav-ui',
      partialize: (s) => ({ soundEnabled: s.soundEnabled }),
    },
  ),
);
