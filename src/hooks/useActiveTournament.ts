import { useEffect } from 'react';
import { limit, onSnapshot, query, where } from 'firebase/firestore';

import { tournamentsCol } from '@/lib/firestore/refs';
import { useTournamentStore } from '@/stores/useTournamentStore';

/**
 * Subscribes to the single active tournament. Mounts one listener for the
 * app lifetime (usually in AppRoot or AdminLayout). If no active tournament
 * exists, `active` in the store is null and callers can prompt the admin
 * to create one via /admin/turnir.
 */
export function useActiveTournament() {
  const setActive = useTournamentStore((s) => s.setActive);
  const setLoading = useTournamentStore((s) => s.setLoading);

  useEffect(() => {
    setLoading(true);
    const q = query(tournamentsCol(), where('status', '==', 'active'), limit(1));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const doc = snap.docs[0];
        setActive(doc ? doc.data() : null);
      },
      () => setActive(null),
    );
    return unsub;
  }, [setActive, setLoading]);
}
