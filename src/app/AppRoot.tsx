import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { useAuthStore, type UserRole } from '@/stores/useAuthStore';
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
      let role: UserRole =
        claim === 'admin' || claim === 'reporter' ? claim : null;

      // Spark-plan fallback: without Cloud Functions we can't set a custom
      // `admin` claim on login, so the client self-promotes by looking up
      // its own email in /adminEmails. Safe because the Firestore rule only
      // lets a signed-in user see their own entry.
      if (!role && user.email) {
        try {
          const snap = await getDocs(
            query(
              collection(db, 'adminEmails'),
              where('email', '==', user.email),
              limit(1),
            ),
          );
          if (!snap.empty) role = 'admin';
        } catch {
          // Rule may not be deployed yet — ignore and leave role null.
        }
      }

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
