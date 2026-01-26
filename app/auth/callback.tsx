'use client';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';
import { ensureProfile } from '../../lib/ensureProfile';
import { isLocalAdmin } from '../../lib/admin';

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
  const params = useLocalSearchParams<{ code?: string; redirect?: string }>();
  const [msg, setMsg] = useState('Signing you in…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let redirectTimeout: NodeJS.Timeout | null = null;

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
        // Web: Handle PKCE flow with code exchange
        if (Platform.OS === 'web' && params.code) {
          const code = Array.isArray(params.code) ? params.code[0] : params.code;
          
          setMsg('Exchanging code for session…');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }

          // Verify session was created
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData?.session) {
            throw new Error('Session not established after code exchange');
          }

          if (!mounted) return;

          // Start profile creation in background (non-blocking)
          ensureProfile().catch((err) => {
            console.warn('ensureProfile error (non-blocking):', err);
          });

          // If we have a redirect param, use it
          if (params.redirect) {
            router.replace(params.redirect);
            return;
          }

          // Determine role and redirect accordingly
          setMsg('Signed in! Redirecting…');
          const redirectPromise = determineRoleAndRedirect(sessionData.session.user);
          // Don't await - let it run but don't block
          redirectPromise.catch((err) => {
            console.error('Redirect error:', err);
            if (mounted) {
              router.replace('/intro');
            }
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
          // Start profile creation in background (non-blocking)
          ensureProfile().catch((err) => {
            console.warn('ensureProfile error (non-blocking):', err);
          });

          // If we have a redirect param, use it
          if (params.redirect) {
            router.replace(params.redirect);
            return;
          }

          // Determine role and redirect accordingly
          setMsg('Signed in! Redirecting…');
          const redirectPromise = determineRoleAndRedirect(sessionData.session.user);
          // Don't await - let it run but don't block
          redirectPromise.catch((err) => {
            console.error('Redirect error:', err);
            if (mounted) {
              router.replace('/intro');
            }
          });
        } else {
          setError('No active session. Try signing in again.');
          setMsg('Authentication failed');
        }
      } catch (e: any) {
        if (!mounted) return;
        const errorMsg = e?.message || 'Authentication failed';
        setError(errorMsg);
        setMsg('Error');
        console.error('Auth callback error:', e);
        
        // Even on error, try to redirect after a delay (user might still be authenticated)
        redirectTimeout = setTimeout(async () => {
          if (mounted) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                await determineRoleAndRedirect(session.user);
              } else {
                router.replace('/intro');
              }
            } catch {
              router.replace('/intro');
            }
          }
        }, 2000);
      }
    }

    handleAuth();

    // Fallback: redirect after 2 seconds no matter what (in case something goes wrong)
    const fallbackTimeout = setTimeout(async () => {
      if (mounted) {
        console.warn('Auth callback fallback: redirecting after timeout');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            // Quick check: if admin from email, redirect immediately
            if (isLocalAdmin(session.user)) {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.href = '/admin';
              } else {
                router.replace('/admin');
              }
            } else {
              // Otherwise let intro page handle it
              router.replace('/intro');
            }
          } else {
            router.replace('/intro');
          }
        } catch {
          router.replace('/intro');
        }
      }
    }, 2000);

    return () => {
      mounted = false;
      if (redirectTimeout) clearTimeout(redirectTimeout);
      clearTimeout(fallbackTimeout);
    };
  }, [router, params.code, params.redirect]);

  return (
    <View style={{flex:1, alignItems:'center', justifyContent:'center', padding:16, backgroundColor: '#F2F0EF'}}>
      <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
      <Text style={{color: theme.colors.text, fontSize: 16, marginBottom: 8}}>Loading</Text>
      {error && (
        <Text style={{color: '#ef4444', fontSize: 14, textAlign: 'center', marginTop: 8}}>{error}</Text>
      )}
    </View>
  );
}

