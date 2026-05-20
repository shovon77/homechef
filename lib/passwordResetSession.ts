import { Platform } from 'react-native';

const PENDING_PASSWORD_RESET_KEY = 'pendingPasswordReset';

export function markPendingPasswordReset(): void {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(PENDING_PASSWORD_RESET_KEY, '1');
  }
}

export function clearPendingPasswordReset(): void {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(PENDING_PASSWORD_RESET_KEY);
  }
}

export function hasPendingPasswordReset(): boolean {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem(PENDING_PASSWORD_RESET_KEY) === '1';
  }
  return false;
}

/** True when the URL still has Supabase auth params (code / token_hash). */
export function urlHasAuthCallbackParams(href?: string): boolean {
  try {
    const raw = href ?? (typeof window !== 'undefined' ? window.location.href : '');
    if (!raw) return false;
    const url = new URL(raw);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    return Boolean(
      url.searchParams.get('code') ||
      url.searchParams.get('token_hash') ||
      hash.get('code') ||
      hash.get('token_hash')
    );
  } catch {
    return false;
  }
}
