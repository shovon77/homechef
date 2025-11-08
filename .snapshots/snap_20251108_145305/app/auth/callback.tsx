'use client';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../constants/theme';

export default function AuthCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState('Finalizing sign-in…');

  useEffect(() => {
    // Supabase handles hash tokens automatically; just wait for a session then redirect.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setMsg('Signed in! Redirecting…');
        router.replace('/');
      } else {
        setMsg('No active session. Try the email link again or sign in.');
        setTimeout(() => router.replace('/login'), 2000);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={{flex:1, alignItems:'center', justifyContent:'center', padding:16, backgroundColor: theme.colors.background}}>
      <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
      <Text style={{color: theme.colors.text, fontSize: 16}}>{msg}</Text>
    </View>
  );
}

