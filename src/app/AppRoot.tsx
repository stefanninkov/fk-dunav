import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOfflineStore } from '@/stores/useOfflineStore';
import { useUIStore } from '@/stores/useUIStore';

/**
 * Root layout. Wires global side effects: auth state hydration, online/
 * offline listeners, reduced-motion detection. Every route renders under
 * this component so the listeners mount exactly once.
 */
export function AppRoot() {
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clear);
  const setOnline = useOfflineStore((s) => s.setOnline);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        clearAuth();
        return;
      }
      const token = await user.getIdTokenResult();
      const claim = token.claims.role;
      const role = claim === 'admin' || claim === 'reporter' ? claim : null;
      setUser({ uid: user.uid, email: user.email, role });
    });
    return unsub;
  }, [setUser, clearAuth]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [setReducedMotion]);

  return <Outlet />;
}
