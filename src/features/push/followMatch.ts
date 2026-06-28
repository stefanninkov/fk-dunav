import {
  arrayRemove,
  arrayUnion,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';

import { getMessagingIfSupported } from '@/lib/firebase';
import { pushSubscriptionDoc } from '@/lib/firestore/refs';

const DEVICE_ID_KEY = 'fk-dunav:device-id';
const FCM_TOKEN_KEY = 'fk-dunav:fcm-token';

function getOrCreateDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Register the FCM service worker and resolve an FCM token for this device.
 * Returns null if messaging is unsupported, permission was denied, or the
 * VAPID key isn't configured.
 *
 * The VAPID key must be provided via VITE_FIREBASE_VAPID_KEY. Generate it
 * in the Firebase console → Project settings → Cloud Messaging → Web Push
 * certificates → Generate key pair.
 */
export async function ensureFcmToken(): Promise<string | null> {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  if (Notification.permission === 'denied') return null;
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return null;
  }

  // Register the SW ourselves so we can use the /fk-dunav/ base path on
  // GitHub Pages (`getToken` without a registration would look at the
  // origin root, which 404s).
  const swUrl = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;
  const registration = await navigator.serviceWorker.register(swUrl, {
    scope: import.meta.env.BASE_URL,
  });

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  try {
    window.localStorage.setItem(FCM_TOKEN_KEY, token);
  } catch {
    /* noop */
  }
  return token;
}

/** Add a matchId to this device's subscription. Upserts the doc if missing. */
export async function followMatch(matchId: string): Promise<string | null> {
  const token = await ensureFcmToken();
  if (!token) return null;

  await setDoc(
    pushSubscriptionDoc(token),
    {
      token,
      deviceId: getOrCreateDeviceId(),
      matchIds: arrayUnion(matchId),
      subscribedToBroadcasts: true,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      invalid: false,
    } as never,
    { merge: true },
  );

  return token;
}

/** Remove a matchId from this device's subscription. */
export async function unfollowMatch(matchId: string): Promise<void> {
  let token: string | null = null;
  try {
    token = window.localStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    /* noop */
  }
  if (!token) return;
  await setDoc(
    pushSubscriptionDoc(token),
    { matchIds: arrayRemove(matchId), lastSeenAt: serverTimestamp() } as never,
    { merge: true },
  );
}

/**
 * Attach a foreground listener for FCM messages. The background SW handles
 * push when the tab is hidden; this fires when the user is actively on the
 * page, where we show an in-app toast instead of a system notification.
 */
export async function attachForegroundMessageListener(
  handler: (title: string, body: string) => void,
): Promise<() => void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    handler(
      payload.notification?.title ?? '',
      payload.notification?.body ?? '',
    );
  });
}
