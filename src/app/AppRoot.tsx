import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
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
 * Root layout. Wires global side effects: auth state hydration, online/
 * offline listeners, reduced-motion detection. Every route renders under
 * this component so the listeners mount exactly once.
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
        // Tournament-day mode: open admin panel — anyone with the URL
        // gets an anonymous Firebase session so writes go through. Rules
        // grant any signed-in user the staff capability set during the
        // event. Tighten back to email-link login after the tournament.
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error('Anonymous sign-in failed', err);
          clearAuth();
        }
        return;
      }

      if (user.isAnonymous) {
        // Treat anonymous sessions as full staff for the duration of the
        // tournament. No /admins write, no caps lookup — the role is set
        // entirely on the client.
        setUser({
          uid: user.uid,
          email: null,
          role: 'staff',
          caps: [...ALL_CAPABILITIES],
        });
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
      } catch (err) {
        // Rules may still be propagating on a fresh deploy. Log it so the
        // user can see the actual reason in Sentry instead of silently
        // sitting on the login screen.
        console.error('Auth role lookup failed', err);
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
