import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  type Analytics,
} from 'firebase/analytics';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import {
  getMessaging,
  isSupported as isMessagingSupported,
  type Messaging,
} from 'firebase/messaging';

/**
 * Firebase config is read from Vite env vars (VITE_FIREBASE_*). The values
 * are not secrets — Firebase JS SDK config is designed to be shipped to
 * browsers, and access is gated server-side by Firestore/Storage rules,
 * Firebase Auth authorized domains, and App Check. See README for the full
 * list.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);

/**
 * App Check — proves requests come from our real web app, not a script.
 * Initialized eagerly because every Firestore read on the public site
 * needs a token. App Check SDK is small (~5 KB gzipped) so the cost is
 * fine.
 *
 * Enforcement is controlled per-service in the Firebase console; the
 * client always tries to send a token whether enforcement is on or not.
 */
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
export let appCheck: AppCheck | null = null;
if (appCheckSiteKey && !useEmulators) {
  try {
    appCheck = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('App Check init skipped:', err);
  }
}

// Firestore with offline persistence enabled from the start — mandatory
// for the reporter workflow. Multi-tab manager keeps tabs in sync.
export const db: Firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth: Auth = getAuth(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);
export const functions: Functions = getFunctions(firebaseApp, 'europe-west3');

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

/**
 * Backwards-compatible promise wrapper. Earlier code paths used the
 * lazy `getAuthInstance()` helper; we keep the signature so callers
 * don't have to change, but it just resolves the eager `auth` export.
 */
export async function getAuthInstance(): Promise<Auth> {
  return auth;
}

/**
 * Analytics initializes asynchronously — the SDK is only supported in
 * browsers, on secure contexts, and requires measurementId. We skip it
 * when talking to emulators (no real events to log) and when running in
 * dev to avoid noisy data.
 */
export let analytics: Analytics | null = null;
if (!useEmulators && import.meta.env.PROD && firebaseConfig.measurementId) {
  void isAnalyticsSupported().then((supported) => {
    if (supported) analytics = getAnalytics(firebaseApp);
  });
}

/**
 * Messaging is also async-gated because it's only supported in secure
 * contexts with a Service Worker available. Consumers (FollowMatchButton)
 * import `getMessagingIfSupported` and skip gracefully when it returns null.
 */
export async function getMessagingIfSupported(): Promise<Messaging | null> {
  try {
    const supported = await isMessagingSupported();
    return supported ? getMessaging(firebaseApp) : null;
  } catch {
    return null;
  }
}
