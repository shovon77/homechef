'use client';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    try {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // read role and route
      const { data: prof } = await supabase.from('profiles').select('role').single();
      const role = prof?.role === 'chef' ? 'chef' : 'user';
      router.replace(role === 'chef' ? '/chef' : '/');
    } catch (e: any) {
      alert(e?.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const disabled = !email || !password || busy;

  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center', gap:12, padding:16 }}>
      <Text style={{ fontSize:24, fontWeight:'bold' }}>Sign in</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ width:260, borderWidth:1, borderColor:'#333', borderRadius:8, padding:10, color:'#fff' }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ width:260, borderWidth:1, borderColor:'#333', borderRadius:8, padding:10, color:'#fff' }}
      />

      <TouchableOpacity
        onPress={submit}
        disabled={disabled}
        style={{ backgroundColor: disabled ? '#9ca3af' : '#f59e0b', paddingVertical:10, paddingHorizontal:18, borderRadius:8, marginTop:8 }}
      >
        <Text style={{ fontWeight:'600' }}>{busy ? 'Please wait…' : 'Sign in'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/auth')}>
        <Text style={{ color:'#60a5fa', marginTop:10 }}>New here? Create an account</Text>
      </TouchableOpacity>
    </View>
  );
}
