import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { useAuthStore, type UserRole } from '@/stores/useAuthStore';
import { useOfflineStore } from '@/stores/useOfflineStore';
import { useUIStore } from '@/stores/useUIStore';
import { useActiveTournament } from '@/hooks/useActiveTournament';

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
  useActiveTournament();

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
      // `admin` claim on login. Instead the client self-promotes by
      //   1) looking up its own email in /adminEmails,
      //   2) writing a /admins/{uid} doc so security rules can check
      //      membership with a cheap exists() — no queries in rules.
      if (!role && user.email) {
        try {
          const existing = await getDoc(doc(db, 'admins', user.uid));
          if (existing.exists()) {
            role = 'admin';
          } else {
            const match = await getDocs(
              query(
                collection(db, 'adminEmails'),
                where('email', '==', user.email),
                limit(1),
              ),
            );
            if (!match.empty) {
              await setDoc(doc(db, 'admins', user.uid), {
                email: user.email,
                promotedAt: serverTimestamp(),
              });
              role = 'admin';
            }
          }
        } catch {
          // Rules may still be propagating; leave role null and let
          // AuthGuard keep the user on /admin/login. They can retry.
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
