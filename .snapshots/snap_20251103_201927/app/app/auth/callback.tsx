'use client';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState('Finalizing sign-in…');

  useEffect(() => {
    // Supabase handles hash tokens automatically; just wait for a session then redirect.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setMsg('Signed in! Redirecting…');
        router.replace('/admin');
      } else {
        setMsg('No active session. Try the email link again or sign in.');
      }
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{flex:1, alignItems:'center', justifyContent:'center', padding:16}}>
      <Text style={{color:'#f8fafc'}}>{msg}</Text>
    </View>
  );
}
