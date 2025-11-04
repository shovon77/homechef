'use client';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ensureUser } from '../../lib/ensureUser';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signup'|'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  const redirectTo = (() => {
    try {
      if (Platform.OS !== 'web') return undefined as any;
      return `${window.location.origin}/auth/callback`;
    } catch { return undefined as any; }
  })();

  async function doGoogle() {
    setErr(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
  }

  async function doEmailPassword() {
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await ensureUser();
      router.replace('/');
    } catch (e:any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16, gap:14 }}>
      <Text style={{ color:'#f8fafc', fontWeight:'900', fontSize:22 }}>
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </Text>

      <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
        <Text style={{ color:'#0ea5e9' }}>
          {mode === 'signup' ? 'Have an account? Sign in' : 'New here? Create account'}
        </Text>
      </TouchableOpacity>

      {/* Google OAuth */}
      <TouchableOpacity onPress={doGoogle} style={{ backgroundColor:'#ef4444', paddingVertical:10, paddingHorizontal:16, borderRadius:8 }}>
        <Text style={{ color:'#fff', fontWeight:'800' }}>Continue with Google</Text>
      </TouchableOpacity>

      {/* Email / Password */}
      <View style={{ width:320, gap:8 }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          style={{ backgroundColor:'#0f172a', color:'#e2e8f0', padding:10, borderRadius:8, borderWidth:1, borderColor:'#1f2937' }}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="password"
          secureTextEntry
          style={{ backgroundColor:'#0f172a', color:'#e2e8f0', padding:10, borderRadius:8, borderWidth:1, borderColor:'#1f2937' }}
        />
        <TouchableOpacity onPress={doEmailPassword} disabled={busy} style={{ backgroundColor:'#22c55e', paddingVertical:10, borderRadius:8, alignItems:'center' }}>
          <Text style={{ color:'#000', fontWeight:'800' }}>{busy ? 'Please wait…' : (mode === 'signup' ? 'Create account' : 'Sign in')}</Text>
        </TouchableOpacity>

        {Platform.OS === 'web' ? (
          // @ts-ignore
          <a href="/auth/magic" style={{ color:'#0ea5e9', marginTop:8, display:'inline-block' }}>
            Use email link instead (no password)
          </a>
        ) : null}
      </View>

      {err ? <Text style={{ color:'red' }}>{err}</Text> : null}
    </View>
  );
}
