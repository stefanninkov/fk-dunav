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
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import {
  getMessaging,
  isSupported as isMessagingSupported,
  type Messaging,
} from 'firebase/messaging';

/**
 * Firebase config is read from Vite env vars (VITE_FIREBASE_*). The values
 * are not secrets — the JS SDK config is designed to be shipped to browsers,
 * and access is gated server-side by Firestore/Storage rules + Auth domain
 * whitelist + App Check. See README for the full list.
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
 * Must be initialized BEFORE any other Firebase service call so every
 * outgoing request carries the token. In dev (emulators on, or no site
 * key) we skip entirely; in dev against real prod, set
 *   (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
 * before this runs to get a per-browser debug token, then whitelist it in
 * the Firebase console → App Check → Debug tokens.
 *
 * Enforcement is controlled PER-SERVICE in the Firebase console. We ship
 * unenforced first, watch metrics, then flip enforcement on once 95%+ of
 * requests carry valid tokens.
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
    // Double-init throws in dev with HMR; safe to swallow.
    console.warn('App Check init skipped:', err);
  }
}

// Firestore with offline persistence enabled from the start — mandatory for
// the reporter workflow. Multi-tab manager keeps tabs in sync.
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
