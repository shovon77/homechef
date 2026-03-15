/**
 * Detect if the app is running inside an in-app browser (e.g. Facebook Messenger,
 * Facebook, Instagram) where OAuth (e.g. Google sign-in) is often blocked.
 * Only valid on web; returns false on native or when navigator is unavailable.
 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
  const ua = navigator.userAgent;
  return (
    ua.includes('FBAN') ||
    ua.includes('FBAV') ||
    ua.includes('Instagram') ||
    ua.includes('FBIOS') ||
    ua.includes('FB_IAB')
  );
}

/** Returns true if the path is an auth/onboarding page where Google OAuth is used - show "Open in browser" only on these */
export function isAuthOrOnboardingPath(pathname: string): boolean {
  const path = pathname ?? '/';
  return (
    path.startsWith('/auth') ||
    path.startsWith('/login') ||
    path.startsWith('/signup') ||
    path.startsWith('/chef-apply')
  );
}
