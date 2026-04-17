import { create } from 'zustand';

export type UserRole = 'admin' | 'reporter' | null;

interface AuthState {
  uid: string | null;
  email: string | null;
  role: UserRole;
  loading: boolean;

  setUser: (user: { uid: string; email: string | null; role: UserRole }) => void;
  clear: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Auth state cache. The authoritative source is Firebase Auth; this store
 * mirrors it so consumers can read synchronously. Role comes from the Firebase
 * custom claim, hydrated by the auth listener in src/app/App.tsx.
 */
export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  email: null,
  role: null,
  loading: true,

  setUser: ({ uid, email, role }) => set({ uid, email, role, loading: false }),
  clear: () => set({ uid: null, email: null, role: null, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
