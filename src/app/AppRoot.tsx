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
import {
  ALL_CAPABILITIES,
  type Capability,
} from '@/lib/firestore/types';
import { useAuthStore, type UserRole } from '@/stores/useAuthStore';
import { useOfflineStore } from '@/stores/useOfflineStore';
import { useUIStore } from '@/stores/useUIStore';
import { useActiveTournament } from '@/hooks/useActiveTournament';

/**
 * Root layout. Wires global side effects: auth state hydration,
 * online/offline listeners, reduced-motion detection. Every route
 * renders under this component so the listeners mount exactly once.
 *
 * Role + capability hydration flow for a freshly signed-in user:
 *   1. email in /adminEmails  → write /admins/{uid}, caps = all
 *   2. /users/{uid} already exists → load role + caps from it
 *   3. /invites/{email} exists and not revoked → write /users/{uid}
 *      with the invite's caps, then load them
 *   4. otherwise → role=null, caps=[] (no admin access)
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

      let role: UserRole = null;
      let caps: Capability[] = [];

      try {
        // Step 1 — hardcoded day-one admins.
        const existingAdmin = await getDoc(doc(db, 'admins', user.uid));
        if (existingAdmin.exists()) {
          role = 'admin';
          caps = [...ALL_CAPABILITIES];
        } else if (user.email) {
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
            caps = [...ALL_CAPABILITIES];
          }
        }

        // Step 2 — existing staff user (non-admin).
        if (role === null) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const data = userSnap.data() as { caps?: Capability[] };
            const savedCaps = Array.isArray(data.caps) ? data.caps : [];
            if (savedCaps.length > 0) {
              role = 'staff';
              caps = savedCaps;
            }
          }
        }

        // Step 3 — first-time consumption of an active invite.
        if (role === null && user.email) {
          const inviteRef = doc(db, 'invites', user.email.toLowerCase());
          const inviteSnap = await getDoc(inviteRef);
          const invite = inviteSnap.data() as
            | { caps?: Capability[]; revoked?: boolean }
            | undefined;
          if (inviteSnap.exists() && invite && !invite.revoked) {
            const inviteCaps = Array.isArray(invite.caps)
              ? invite.caps.filter((c): c is Capability =>
                  ALL_CAPABILITIES.includes(c),
                )
              : [];
            if (inviteCaps.length > 0) {
              await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                caps: inviteCaps,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
              });
              role = 'staff';
              caps = inviteCaps;
            }
          }
        }
      } catch {
        // Rules may still be propagating on a fresh deploy; leave role=null
        // and let AuthGuard redirect to login. User can retry.
      }

      setUser({ uid: user.uid, email: user.email, role, caps });
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
