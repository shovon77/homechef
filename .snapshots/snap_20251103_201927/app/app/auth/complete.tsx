'use client';
import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Role = 'user' | 'chef';

export default function CompleteSignup() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = useMemo(() => String(params.email || ''), [params.email]);
  const password = useMemo(() => String(params.password || ''), [params.password]);
  const [role, setRole] = useState<Role>('user');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    try {
      setBusy(true);
      // create user
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      const uid = data.user?.id;
      if (uid) {
        const { error: upErr } = await supabase.from('profiles').upsert({ id: uid, role });
        if (upErr) throw upErr;
      }
      // route by role
      router.replace(role === 'chef' ? '/chef' : '/');
    } catch (e: any) {
      alert(e?.message || 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  const invalid = !email || !password;

  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center', gap:14, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:'bold' }}>Choose your role</Text>
      <Text style={{ opacity:0.8 }}>Email: {email || '(missing)'} </Text>

      <View style={{ flexDirection:'row', gap:16, marginTop:6 }}>
        <TouchableOpacity onPress={()=>setRole('user')}>
          <Text style={{ fontSize:16, color: role==='user' ? '#fbbf24' : '#9ca3af' }}>User</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setRole('chef')}>
          <Text style={{ fontSize:16, color: role==='chef' ? '#fbbf24' : '#9ca3af' }}>Chef</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={finish}
        disabled={busy || invalid}
        style={{ backgroundColor: (busy || invalid) ? '#9ca3af' : '#f59e0b', paddingVertical:10, paddingHorizontal:18, borderRadius:8, marginTop:8 }}
      >
        <Text style={{ fontWeight:'600' }}>{busy ? 'Please wait…' : 'Finish sign up'}</Text>
      </TouchableOpacity>

      <Text style={{ opacity:0.7, maxWidth:320, textAlign:'center' }}>
        We’ll create your account and send you to {role === 'chef' ? 'your Chef Dashboard' : 'the home page'}.
      </Text>
    </View>
  );
}
