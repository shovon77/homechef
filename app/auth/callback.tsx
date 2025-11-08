'use client';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';
import { ensureProfile } from '../../lib/ensureProfile';
import { useRole } from '../../hooks/useRole';

/**
 * Auth callback handler for both web (PKCE) and native flows
 * 
 * Verification:
 * - Web: Extracts `code` from URL, exchanges for session via exchangeCodeForSession
 * - Native: Calls getSession() to check for established session
 * - Both: Redirect to home `/` after successful auth
 */
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; redirect?: string }>();
  const [msg, setMsg] = useState('Signing you in…');
  const [error, setError] = useState<string | null>(null);
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const { loading, role } = useRole();

  useEffect(() => {
    let mounted = true;

    async function handleAuth() {
      try {
        // Web: Handle PKCE flow with code exchange
        if (Platform.OS === 'web' && params.code) {
          setMsg('Exchanging code for session…');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession({
            code: params.code as string,
          });

          if (exchangeError) {
            throw exchangeError;
          }

          // Verify session was created
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData?.session) {
            throw new Error('Session not established after code exchange');
          }

          // Ensure profile exists
          const profileResult = await ensureProfile();
          if (!profileResult.ok) {
            console.warn('ensureProfile failed:', profileResult.error);
          }

          if (!mounted) return;
          setSessionEstablished(true);
          setMsg('Signed in! Redirecting…');
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
          // Ensure profile exists
          const profileResult = await ensureProfile();
          if (!profileResult.ok) {
            console.warn('ensureProfile failed:', profileResult.error);
          }

          if (!mounted) return;
          setSessionEstablished(true);
          setMsg('Signed in! Redirecting…');
        } else {
          setError('No active session. Try signing in again.');
          setMsg('Authentication failed');
          setTimeout(() => router.replace('/login'), 2000);
        }
      } catch (e: any) {
        if (!mounted) return;
        const errorMsg = e?.message || 'Authentication failed';
        setError(errorMsg);
        setMsg('Error');
        console.error('Auth callback error:', e);
        setTimeout(() => router.replace('/login'), 3000);
      }
    }

    handleAuth();

    return () => {
      mounted = false;
    };
  }, [router, params.code, params.redirect]);

  // Route based on role after session is established and role is loaded
  useEffect(() => {
    if (sessionEstablished && !loading) {
      const redirectTo = params.redirect || (role === 'admin' ? '/admin' : role === 'chef' ? '/chef/dashboard' : '/');
      router.replace(redirectTo);
    }
  }, [sessionEstablished, loading, role, router, params.redirect]);

  return (
    <View style={{flex:1, alignItems:'center', justifyContent:'center', padding:16, backgroundColor: theme.colors.surface}}>
      <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
      <Text style={{color: theme.colors.text, fontSize: 16, marginBottom: 8}}>{msg}</Text>
      {error && (
        <Text style={{color: '#ef4444', fontSize: 14, textAlign: 'center', marginTop: 8}}>{error}</Text>
      )}
    </View>
  );
}

