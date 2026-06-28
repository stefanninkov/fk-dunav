import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Bell, BellRing, BellOff } from 'lucide-react';

import { pushSubscriptionDoc } from '@/lib/firestore/refs';
import {
  followMatch,
  unfollowMatch,
} from '@/features/push/followMatch';
import { iosNeedsInstallForPush } from '@/features/push/iosInstall';
import { IosInstallSheet } from '@/features/push/IosInstallSheet';

const FCM_TOKEN_KEY = 'fk-dunav:fcm-token';

interface Props {
  matchId: string;
}

/**
 * Toggles push notifications for a specific match on this device.
 * Handles permission prompt, registration, and unsubscribe. Renders
 * three states: not-subscribed, subscribed, and unsupported.
 */
export function FollowMatchButton({ matchId }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iosSheet, setIosSheet] = useState(false);

  // Hydrate from the stored token + a Firestore snapshot listener so the
  // UI stays truthy even if the user subscribes on another tab.
  useEffect(() => {
    let cached: string | null = null;
    try {
      cached = window.localStorage.getItem(FCM_TOKEN_KEY);
    } catch {
      /* noop */
    }
    setToken(cached);
    if (!cached) return;
    const unsub = onSnapshot(pushSubscriptionDoc(cached), (snap) => {
      const data = snap.data();
      setFollowing(!!data && data.matchIds.includes(matchId));
    });
    return unsub;
  }, [matchId]);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (following) {
        await unfollowMatch(matchId);
        return;
      }
      // iOS Safari users have to install the PWA first; show the
      // step-by-step sheet instead of silently failing on requestPermission.
      if (iosNeedsInstallForPush()) {
        setIosSheet(true);
        return;
      }
      const t = await followMatch(matchId);
      if (!t) {
        setError(
          typeof Notification !== 'undefined' &&
            Notification.permission === 'denied'
            ? 'Notifikacije su blokirane u browseru.'
            : 'Push nije podržan na ovom uređaju.',
        );
        return;
      }
      setToken(t);
    } finally {
      setBusy(false);
    }
  }

  const label = following ? 'Prati\u0161 ovu utakmicu' : 'Prati utakmicu';
  const Icon = following ? BellRing : token ? Bell : BellOff;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`inline-flex h-touch items-center gap-2 rounded-md px-4 font-600 disabled:opacity-60 ${
          following
            ? 'bg-brand-900 text-brand-200'
            : 'bg-brand-600 text-ink-primary hover:bg-brand-500'
        }`}
      >
        <Icon size={18} />
        {label}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {iosSheet ? <IosInstallSheet onClose={() => setIosSheet(false)} /> : null}
    </div>
  );
}
