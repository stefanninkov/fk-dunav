import { create } from 'zustand';

import type { Capability } from '@/lib/firestore/types';

export type UserRole = 'admin' | 'staff' | null;

interface AuthState {
  uid: string | null;
  email: string | null;
  role: UserRole;
  caps: Capability[];
  loading: boolean;

  setUser: (user: {
    uid: string;
    email: string | null;
    role: UserRole;
    caps: Capability[];
  }) => void;
  clear: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Auth state cache. The authoritative source is Firebase Auth +
 * /users/{uid} (or /admins/{uid}); this store mirrors them so consumers
 * can read synchronously. Admins implicitly hold every capability; the
 * AppRoot hydrator fills `caps` with the full list for them.
 */
export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  email: null,
  role: null,
  caps: [],
  loading: true,

  setUser: ({ uid, email, role, caps }) =>
    set({ uid, email, role, caps, loading: false }),
  clear: () =>
    set({ uid: null, email: null, role: null, caps: [], loading: false }),
  setLoading: (loading) => set({ loading }),
}));

export function hasCapability(caps: Capability[], cap: Capability): boolean {
  return caps.includes(cap);
}
