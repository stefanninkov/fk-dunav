/**
 * iOS web push gating helpers. iOS Safari only supports the Web Push API
 * starting with iOS 16.4 — and only when the site is installed to the
 * Home Screen as a PWA. Showing the regular Notification.requestPermission()
 * prompt in mobile Safari just throws.
 *
 * isIosSafari: detect mobile Safari (excludes Chrome on iOS, which uses
 *              the Safari engine but uses a CriOS user agent and also
 *              doesn't support web push).
 * isStandalone: detect if the page is running as an installed PWA (either
 *               via the modern matchMedia query or the iOS-specific
 *               navigator.standalone flag).
 * iosNeedsInstallForPush: composite — returns true when the device is
 *                          iOS Safari and is NOT yet installed.
 */

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
  if (!isIos) return false;
  // Chrome iOS = CriOS, Firefox iOS = FxiOS, Edge iOS = EdgiOS.
  if (/CriOS|FxiOS|EdgiOS/.test(ua)) return false;
  return /Safari/.test(ua);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS-specific legacy flag.
  return Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

export function iosNeedsInstallForPush(): boolean {
  return isIosSafari() && !isStandalone();
}
