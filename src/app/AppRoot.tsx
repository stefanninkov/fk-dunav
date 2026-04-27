import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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

import { db, getAuthInstance } from '@/lib/firebase';
import {
  ALL_CAPABILITIES,
  type Capability,
} from '@/lib/firestore/types';
import { useAuthStore, type UserRole } from '@/stores/useAuthStore';
import { useOfflineStore } from '@/stores/useOfflineStore';
import { useUIStore } from '@/stores/useUIStore';
import { useActiveTournament } from '@/hooks/useActiveTournament';

/**
 * Root layout. Always-on listeners: online/offline + reduced-motion +
 * active tournament hydration. Auth is lazy: the listener only registers
 * the first time the user lands on an /admin/* path, which keeps the
 * 34 KB firebase/auth module out of the public bundle entirely.
 *
 * Role + capability hydration flow on first sign-in:
 *   1. email in /adminEmails  → write /admins/{uid}, caps = all
 *   2. /users/{uid} already exists → load role + caps from it
 *   3. /invites/{email} exists and not revoked → write /users/{uid}
 *      with the invite's caps, then load them
 *   4. otherwise → role=null, caps=[] (no admin access)
 */
export function AppRoot() {
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clear);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setOnline = useOfflineStore((s) => s.setOnline);
  const setReducedMotion = useUIStore((s) => s.setReducedMotion);
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  useActiveTournament();

  // Auth bootstrap — only runs the first time we hit /admin/*. Stays
  // mounted after that. Public-only sessions never touch firebase/auth.
  useEffect(() => {
    if (!isAdminPath) {
      // Public-only visit: mark loading=false so AuthGuard / UI can move
      // on (no admin user is signed in from this path).
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const auth = await getAuthInstance();
        const { onAuthStateChanged } = await import('firebase/auth');
        if (cancelled) return;
        unsub = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            clearAuth();
            return;
          }

          let role: UserRole = null;
          let caps: Capability[] = [];

          try {
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
            // Rules may still be propagating on a fresh deploy; leave
            // role=null and let AuthGuard redirect to login.
          }

          setUser({ uid: user.uid, email: user.email, role, caps });
        });
      } catch (err) {
        console.error('Auth bootstrap failed', err);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [isAdminPath, setUser, clearAuth, setLoading]);

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
