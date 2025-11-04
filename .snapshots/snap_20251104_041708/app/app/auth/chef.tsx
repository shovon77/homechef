'use client';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { ensureUser } from '../../lib/ensureUser';

const C = {
  bg:'#F4F8F5', panel:'#FFFFFF', border:'#E3EEE8', text:'#0B1F17', sub:'#4A6B5D', primary:'#2DA97B'
};

export default function ChefSignup() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(() => {
    // must be logged in first
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.replace('/auth');
    });
  }, []);

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      const u = (await supabase.auth.getUser()).data?.user;
      if (!u) throw new Error('Please sign in first.');

      // ensure base rows exist
      await ensureUser();

      // upsert chef profile if your schema has "chefs" table
      await supabase.from('chefs').upsert({
        id: undefined,                // let DB assign if serial
        user_id: u.id,                // if you use this
        name: displayName || (u.user_metadata?.name || u.email?.split('@')[0]),
        phone: phone || null,
        is_active: false              // admin can activate later
      });

      // mark user/profile as is_chef
      await supabase.from('users').upsert({ id: u.id, is_chef: true }, { onConflict: 'id' });
      await supabase.from('profiles').upsert({ id: u.id, is_chef: true, role: 'chef' }, { onConflict: 'id' });

      setMsg('Thanks! Your chef profile was submitted. An admin will review it.');
      setTimeout(()=> router.replace('/'), 900);
    } catch (e:any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center', padding:16 }}>
      <View style={{ width:'100%', maxWidth:560, backgroundColor:C.panel, borderWidth:1, borderColor:C.border, borderRadius:16, padding:20, gap:12 }}>
        <Text style={{ color:C.text, fontSize:22, fontWeight:'900' }}>Sign up as a Chef</Text>
        <Text style={{ color:C.sub }}>
          Tell us a bit about you. We’ll create/upgrade your profile and alert the admin team.
        </Text>

        <View style={{ gap:6 }}>
          <Text style={{ color:C.sub, fontWeight:'700' }}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g., Faysal Karim"
            style={{ backgroundColor:'#FAFCFB', borderWidth:1, borderColor:C.border, color:C.text, padding:12, borderRadius:12 }}
          />
        </View>

        <View style={{ gap:6 }}>
          <Text style={{ color:C.sub, fontWeight:'700' }}>Phone (optional)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="(xxx) xxx-xxxx"
            style={{ backgroundColor:'#FAFCFB', borderWidth:1, borderColor:C.border, color:C.text, padding:12, borderRadius:12 }}
          />
        </View>

        <TouchableOpacity onPress={submit} disabled={busy} style={{ backgroundColor: C.primary, paddingVertical:12, borderRadius:12, alignItems:'center' }}>
          <Text style={{ color:'#0b1511', fontWeight:'900' }}>{busy ? 'Submitting…' : 'Submit as Chef'}</Text>
        </TouchableOpacity>

        {msg ? <Text style={{ color: msg.startsWith('Thanks') ? '#15803d':'tomato' }}>{msg}</Text> : null}
      </View>
    </View>
  );
}
