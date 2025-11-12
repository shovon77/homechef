'use client';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

/**
 * Get the auth redirect URL for OAuth flows (Google, Facebook, etc.)
 * 
 * Verification:
 * - Web: Returns `${window.location.origin}/auth/callback` (e.g., http://localhost:8081/auth/callback)
 * - Native: Returns `homechef://auth/callback` using the app scheme
 */
export function getAuthRedirect(): string {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      // SSR fallback
      return '/auth/callback';
    }
    return `${window.location.origin}/auth/callback`;
  }
  
  // Native: use expo-linking to create URL with app scheme
  return Linking.createURL('/auth/callback');
}

/**
 * Get the email redirect URL for magic link / OTP flows
 * Same as getAuthRedirect() - both OAuth and email links use the same callback
 * 
 * Verification:
 * - Web: Returns `${window.location.origin}/auth/callback`
 * - Native: Returns `homechef://auth/callback`
 */
export function getEmailRedirect(): string {
  return getAuthRedirect();
}

export type RoleInfo = {
  is_admin?: boolean | null;
  is_chef?: boolean | null;
  role?: string | null;
};

export function redirectAfterLogin(info: RoleInfo = {}, fallback: string = '/browse') {
  const isAdmin = Boolean(info?.is_admin) || info?.role === 'admin';
  const isChef = Boolean(info?.is_chef) || info?.role === 'chef';

  if (isAdmin) {
    router.replace('/admin');
    return;
  }

  if (isChef) {
    router.replace('/chef');
    return;
  }

  router.replace(fallback);
}

