/**
 * Firebase Cloud Messaging service worker.
 *
 * Registered at /fk-dunav/firebase-messaging-sw.js when served from GitHub
 * Pages. Handles background push events — when the tab is backgrounded or
 * closed, Chrome/Android will wake this SW and show the notification.
 *
 * Foreground messages are handled directly in-app via onMessage() in
 * src/features/push/useMatchSubscription.ts.
 *
 * NOTE: service workers can't use ES modules or import.meta.env, so the
 * Firebase config is inlined here. These values are the same public web
 * config committed to /.env; there are no secrets to leak.
 */

importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js',
);

firebase.initializeApp({
  apiKey: 'AIzaSyCNQYZh7kiaHk1PmSqZC6y-VkZ0lw8KpkU',
  authDomain: 'fk-dunav.firebaseapp.com',
  projectId: 'fk-dunav',
  storageBucket: 'fk-dunav.firebasestorage.app',
  messagingSenderId: '314975519694',
  appId: '1:314975519694:web:29206f8f608ab8c942219f',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'FK Dunav';
  const options = {
    body: payload.notification?.body ?? '',
    icon: '/fk-dunav/assets/logo.svg',
    badge: '/fk-dunav/assets/logo.svg',
    data: payload.data ?? {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link =
    event.notification.data?.matchId
      ? `/fk-dunav/utakmica/${event.notification.data.matchId}`
      : '/fk-dunav/';
  event.waitUntil(clients.openWindow(link));
});
