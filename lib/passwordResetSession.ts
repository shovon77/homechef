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
