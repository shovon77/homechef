'use client';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';
import { ensureProfile } from '../../lib/ensureProfile';
import { isLocalAdmin } from '../../lib/admin';
import { goToPasswordResetScreen } from '../../lib/authRedirect';
import { isPasswordRecoveryFromUrl } from '../../lib/authUrlErrors';
import { completeAuthFromUrl } from '../../lib/authCallbackRecovery';
import { hasPendingPasswordReset } from '../../lib/passwordResetSession';

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function readCallbackParams(routeParams: {
  code?: string;
  type?: string;
  token_hash?: string;
}) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const get = (key: string) => url.searchParams.get(key) || hash.get(key) || undefined;
    return {
      code: get('code') ?? normalizeParam(routeParams.code),
      type: get('type') ?? normalizeParam(routeParams.type),
      token_hash: get('token_hash') ?? normalizeParam(routeParams.token_hash),
    };
  }
  return {
    code: normalizeParam(routeParams.code),
    type: normalizeParam(routeParams.type),
    token_hash: normalizeParam(routeParams.token_hash),
  };
}

function isRecoveryType(type: string | undefined, href: string): boolean {
  return (
    type === 'recovery' ||
    type === 'PASSWORD_RECOVERY' ||
    (Platform.OS === 'web' && isPasswordRecoveryFromUrl(href))
  );
}

/**
 * Auth callback handler for both web (PKCE) and native flows
 */
export default function AuthCallback() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ code?: string; redirect?: string; type?: string; token_hash?: string }>();
  const redirectTarget = normalizeParam(routeParams.redirect);
  const [msg, setMsg] = useState('Signing you in…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    function finishRecovery() {
      if (!mounted) return;
      setMsg('Confirm your new password…');
      goToPasswordResetScreen();
    }

    function finishWithError(message: string) {
      if (!mounted) return;
      setError(message);
      setMsg('Could not complete sign-in');
    }

    async function determineRoleAndRedirect(sessionUser: any) {
      if (!sessionUser) {
        if (Platform.OS === 'web') window.location.replace('/intro');
        else router.replace('/intro');
        return;
      }

      if (isLocalAdmin(sessionUser)) {
        if (Platform.OS === 'web') window.location.replace('/admin');
        else router.replace('/admin');
        return;
      }

      try {
        const roleCheckPromise = Promise.all([
          supabase.from('profiles').select('is_admin, is_chef').eq('id', sessionUser.id).maybeSingle(),
          sessionUser.email
            ? supabase.from('chefs').select('status, is_active').eq('email', sessionUser.email).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const result = await Promise.race([
          roleCheckPromise,
          new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);

        if (!mounted) return;
        if (!result) {
          if (Platform.OS === 'web') window.location.replace('/intro');
          else router.replace('/intro');
          return;
        }

        const [profileResult, chefResult] = result as any;
        const profile = profileResult?.data;
        const chefData = chefResult?.data;
        const isAdmin = profile?.is_admin === true || isLocalAdmin(sessionUser);
        let isChef = profile?.is_chef === true;
        if (isChef && chefData) {
          const inactive = chefData.status === 'inactive' || chefData.is_active === false;
          if (inactive) isChef = false;
        } else if (!isChef && chefData) {
          const active = chefData.status !== 'inactive' && chefData.is_active !== false;
          if (active) isChef = true;
        }

        if (isAdmin) {
          if (Platform.OS === 'web') window.location.replace('/admin');
          else router.replace('/admin');
        } else if (isChef) {
          if (Platform.OS === 'web') window.location.replace('/chef');
          else router.replace('/chef');
        } else {
          if (Platform.OS === 'web') window.location.replace('/intro');
          else router.replace('/intro');
        }
      } catch {
        if (mounted) {
          if (Platform.OS === 'web') window.location.replace('/intro');
          else router.replace('/intro');
        }
      }
    }

    async function handleAuth() {
      const href = typeof window !== 'undefined' ? window.location.href : '';
      const { code, type, token_hash: tokenHash } = readCallbackParams(routeParams);
      const recovery = isRecoveryType(type, href);
      const hasUrlAuthParams = Boolean(code || tokenHash);

      try {
        if (Platform.OS === 'web' && hasUrlAuthParams) {
          setMsg(tokenHash ? 'Verifying reset link…' : 'Exchanging code for session…');

          let { data: sessionData } = await supabase.auth.getSession();

          if (!sessionData?.session) {
            const { error: authError, isRecovery: recovered } = await completeAuthFromUrl({
              href,
              code,
              type,
              token_hash: tokenHash,
            });
            if (authError) throw authError;
            ({ data: sessionData } = await supabase.auth.getSession());
            if (!sessionData?.session) {
              throw new Error('Session not established. Please request a new reset link.');
            }
            if (recovered || recovery) {
              finishRecovery();
              return;
            }
          } else if (recovery || hasPendingPasswordReset()) {
            finishRecovery();
            return;
          }

          if (!sessionData?.session) {
            throw new Error('Session not established. Please request a new reset link.');
          }

          ensureProfile().catch(() => {});

          if (recovery) {
            finishRecovery();
            return;
          }

          if (redirectTarget) {
            if (Platform.OS === 'web') window.location.replace(redirectTarget);
            else router.replace(redirectTarget as any);
            return;
          }

          setMsg('Signed in! Redirecting…');
          await determineRoleAndRedirect(sessionData.session.user);
          return;
        }

        setMsg('Checking session…');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (sessionData?.session) {
          ensureProfile().catch(() => {});
          if (recovery || hasPendingPasswordReset()) {
            finishRecovery();
            return;
          }
          if (redirectTarget) {
            router.replace(redirectTarget as any);
            return;
          }
          setMsg('Signed in! Redirecting…');
          await determineRoleAndRedirect(sessionData.session.user);
        } else {
          finishWithError('No active session. Try signing in again.');
        }
      } catch (e: any) {
        finishWithError(e?.message || 'Authentication failed');
        console.error('Auth callback error:', e);
      }
    }

    void handleAuth();

    return () => {
      mounted = false;
    };
    // Run once per full page load; auth params come from window.location on web.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#F2F0EF' }}>
      <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
      <Text style={{ color: theme.colors.text, fontSize: 16, marginBottom: 8 }}>{msg}</Text>
      {error ? (
        <View style={{ alignItems: 'center', gap: 12, marginTop: 8, maxWidth: 360 }}>
          <Text style={{ color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS === 'web') window.location.replace('/login');
              else router.replace('/login' as any);
            }}
            style={{ paddingVertical: 10, paddingHorizontal: 16 }}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Back to login</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
