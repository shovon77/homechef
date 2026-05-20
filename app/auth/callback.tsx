'use client';
import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';
import { ensureProfile } from '../../lib/ensureProfile';
import { isLocalAdmin } from '../../lib/admin';
import { goToPasswordResetScreen } from '../../lib/authRedirect';
import { isPasswordRecoveryFromUrl } from '../../lib/authUrlErrors';
import { completeAuthFromUrl } from '../../lib/authCallbackRecovery';

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

/**
 * Auth callback handler for both web (PKCE) and native flows
 * 
 * Verification:
 * - Web: Extracts `code` from URL, exchanges for session via exchangeCodeForSession
 * - Native: Calls getSession() to check for established session
 * - Both: Redirect to appropriate dashboard based on role:
 *         - Admins -> /admin
 *         - Chefs -> /chef
 *         - Regular users -> /intro
 */
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; redirect?: string; type?: string; token_hash?: string }>();
  const redirectTarget = normalizeParam(params.redirect);
  const authType = normalizeParam(params.type);
  const tokenHash = normalizeParam(params.token_hash);
  const authCode = normalizeParam(params.code);
  const [msg, setMsg] = useState('Signing you in…');
  const [error, setError] = useState<string | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    function goToRedirectTarget() {
      if (!redirectTarget) return false;
      router.replace(redirectTarget as any);
      return true;
    }

    async function determineRoleAndRedirect(sessionUser: any) {
      if (!sessionUser) {
        console.log('No session user, redirecting to intro');
        router.replace('/intro');
        return;
      }

      // Check admin status from email first (instant, no DB query needed)
      const isAdminFromEmail = isLocalAdmin(sessionUser);
      if (isAdminFromEmail) {
        console.log('Admin detected from email, redirecting to /admin');
        // Use window.location for web to force immediate redirect
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = '/admin';
        } else {
          router.replace('/admin');
        }
        return;
      }

      try {
        // Fetch profile and chef data in parallel with timeout
        const roleCheckPromise = Promise.all([
          supabase
            .from('profiles')
            .select('is_admin, is_chef')
            .eq('id', sessionUser.id)
            .maybeSingle(),
          sessionUser.email
            ? supabase
                .from('chefs')
                .select('status, is_active')
                .eq('email', sessionUser.email)
                .maybeSingle()
            : Promise.resolve({ data: null })
        ]);

        // Add timeout to role check (1.5 seconds max)
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve(null), 1500)
        );

        const result = await Promise.race([roleCheckPromise, timeoutPromise]);

        if (!mounted) return;

        // If timeout, redirect to intro (let intro page handle role detection)
        if (!result) {
          console.warn('Role check timed out, redirecting to intro');
          router.replace('/intro');
          return;
        }

        const [profileResult, chefResult] = result as any;
        const profile = profileResult?.data;
        const chefData = chefResult?.data;

        // Check if admin (from profile)
        const isAdminFromProfile = profile?.is_admin === true;
        const isAdmin = isAdminFromProfile || isAdminFromEmail;

        // Check if chef
        let isChef = profile?.is_chef === true;
        if (isChef && chefData) {
          const chefIsInactive = chefData.status === 'inactive' || chefData.is_active === false;
          if (chefIsInactive) {
            isChef = false;
          }
        } else if (!isChef && chefData) {
          const chefIsActive = chefData.status !== 'inactive' && chefData.is_active !== false;
          if (chefIsActive) {
            isChef = true;
          }
        }

        // Redirect based on role
        if (isAdmin) {
          console.log('Admin detected, redirecting to /admin');
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.href = '/admin';
          } else {
            router.replace('/admin');
          }
        } else if (isChef) {
          console.log('Chef detected, redirecting to /chef');
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.href = '/chef';
          } else {
            router.replace('/chef');
          }
        } else {
          console.log('Regular user, redirecting to /intro');
          router.replace('/intro');
        }
      } catch (err) {
        console.warn('Error determining role, redirecting to intro:', err);
        if (mounted) {
          router.replace('/intro');
        }
      }
    }

    async function handleAuth() {
      try {
        const recoveryFromUrl =
          authType === 'recovery' ||
          authType === 'PASSWORD_RECOVERY' ||
          (typeof window !== 'undefined' && isPasswordRecoveryFromUrl(window.location.href));

        const hasUrlAuthParams = Boolean(authCode || tokenHash);

        // Web: token_hash (email) or PKCE code in callback URL
        if (Platform.OS === 'web' && hasUrlAuthParams) {
          setMsg(tokenHash ? 'Verifying reset link…' : 'Exchanging code for session…');

          let { data: sessionData } = await supabase.auth.getSession();

          if (!sessionData?.session) {
            const { error: authError, isRecovery: recovered } = await completeAuthFromUrl({
              href: typeof window !== 'undefined' ? window.location.href : undefined,
              code: authCode,
              type: authType,
              token_hash: tokenHash,
            });

            if (authError) {
              throw authError;
            }

            ({ data: sessionData } = await supabase.auth.getSession());
            if (!sessionData?.session) {
              throw new Error('Session not established. Please request a new reset link.');
            }

            if (recovered || recoveryFromUrl) {
              finishedRef.current = true;
              setMsg('Confirm your new password…');
              goToPasswordResetScreen();
              return;
            }
          }

          if (!sessionData?.session) {
            throw new Error('Session not established. Please request a new reset link.');
          }

          if (!mounted) return;

          ensureProfile().catch((err) => {
            console.warn('ensureProfile error (non-blocking):', err);
          });

          if (recoveryFromUrl) {
            finishedRef.current = true;
            setMsg('Confirm your new password…');
            goToPasswordResetScreen();
            return;
          }

          finishedRef.current = true;
          if (goToRedirectTarget()) return;

          setMsg('Signed in! Redirecting…');
          determineRoleAndRedirect(sessionData!.session!.user).catch((err) => {
            console.error('Redirect error:', err);
            if (mounted) router.replace('/intro');
          });
          return;
        }

        // Native or web without code: check for existing session
        // (Native deep links establish session automatically)
        setMsg('Checking session…');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!mounted) return;

        if (sessionData?.session) {
          ensureProfile().catch((err) => {
            console.warn('ensureProfile error (non-blocking):', err);
          });

          if (recoveryFromUrl) {
            finishedRef.current = true;
            goToPasswordResetScreen();
            return;
          }

          finishedRef.current = true;
          if (goToRedirectTarget()) return;

          setMsg('Signed in! Redirecting…');
          determineRoleAndRedirect(sessionData.session.user).catch((err) => {
            console.error('Redirect error:', err);
            if (mounted) router.replace('/intro');
          });
        } else {
          finishedRef.current = true;
          setError('No active session. Try signing in again.');
          setMsg('Authentication failed');
        }
      } catch (e: any) {
        if (!mounted) return;
        finishedRef.current = true;
        const errorMsg = e?.message || 'Authentication failed';
        setError(errorMsg);
        setMsg('Could not complete sign-in');
        console.error('Auth callback error:', e);
      }
    }

    handleAuth();

    // Fallback only when auth did not finish (avoid redirect loop on errors)
    const fallbackTimeout = setTimeout(async () => {
      if (!mounted || finishedRef.current) return;
      console.warn('Auth callback fallback: redirecting after timeout');
      try {
        if (redirectTarget) {
          router.replace(redirectTarget as any);
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (isLocalAdmin(session.user)) {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.href = '/admin';
            } else {
              router.replace('/admin');
            }
          } else {
            router.replace('/intro');
          }
        }
      } catch {
        // Stay on page; user can use Back to login
      }
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimeout);
    };
  }, [router, authCode, tokenHash, authType, redirectTarget]);

  return (
    <View style={{flex:1, alignItems:'center', justifyContent:'center', padding:16, backgroundColor: '#F2F0EF'}}>
      <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
      <Text style={{color: theme.colors.text, fontSize: 16, marginBottom: 8}}>Loading</Text>
      {error ? (
        <View style={{ alignItems: 'center', gap: 12, marginTop: 8, maxWidth: 360 }}>
          <Text style={{ color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity
            onPress={() => router.replace('/login' as any)}
            style={{ paddingVertical: 10, paddingHorizontal: 16 }}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Back to login</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

