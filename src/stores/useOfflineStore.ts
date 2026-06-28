import { create } from 'zustand';

interface OfflineState {
  online: boolean;
  pendingWrites: number;

  setOnline: (online: boolean) => void;
  setPendingWrites: (n: number) => void;
  incrementPending: () => void;
  decrementPending: () => void;
}

/**
 * Offline / queue indicator. Firestore handles the actual offline queueing
 * via persistentLocalCache — this store exists for UI affordances only
 * (<OfflineBadge />, <OfflineQueueIndicator />). Wired up from an online/
 * offline listener in src/app/App.tsx.
 */
export const useOfflineStore = create<OfflineState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pendingWrites: 0,

  setOnline: (online) => set({ online }),
  setPendingWrites: (pendingWrites) => set({ pendingWrites }),
  incrementPending: () => set((s) => ({ pendingWrites: s.pendingWrites + 1 })),
  decrementPending: () => set((s) => ({ pendingWrites: Math.max(0, s.pendingWrites - 1) })),
}));
