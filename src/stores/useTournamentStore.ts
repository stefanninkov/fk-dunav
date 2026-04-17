import { create } from 'zustand';

import type { Tournament } from '@/lib/firestore/types';

interface TournamentState {
  active: Tournament | null;
  loading: boolean;

  setActive: (t: Tournament | null) => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Currently-active tournament cache. Populated by the useActiveTournament
 * hook's onSnapshot listener, consumed across the dashboard. Only one
 * tournament can have status='active' at a time (enforced at the UI level
 * in /admin/turnir and by convention — no unique index is possible in
 * Firestore).
 */
export const useTournamentStore = create<TournamentState>((set) => ({
  active: null,
  loading: true,

  setActive: (active) => set({ active, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
