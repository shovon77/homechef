'use client';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { ensureUser } from '../../lib/ensureUser';

export default function DebugMe() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [usersRow, setUsersRow] = useState<any>(null);
  const [profilesRow, setProfilesRow] = useState<any>(null);
  const [msg, setMsg] = useState<string>('');

  async function refresh() {
    setMsg('');
    const s = await supabase.auth.getSession();
    setSession(s.data?.session || null);
    const u = await supabase.auth.getUser();
    setUser(u.data?.user || null);
    const id = u.data?.user?.id;
    if (id) {
      const ures = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      setUsersRow(ures.data || null);
      const pres = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      setProfilesRow(pres.data || null);
      if (ures.error) setMsg(`users select error: ${ures.error.message}`);
      else if (pres.error) setMsg(`profiles select error: ${pres.error.message}`);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function doEnsure() {
    const res = await ensureUser();
    if (!res.ok) setMsg(res.error || 'unknown error');
    await refresh();
  }

  return (
    <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>
      <Text style={{ color:'#f8fafc', fontWeight:'900', fontSize:20 }}>Debug / Me</Text>
      <TouchableOpacity onPress={refresh} style={{ backgroundColor:'#0ea5e9', padding:8, borderRadius:8, alignSelf:'flex-start' }}>
        <Text style={{ color:'#fff', fontWeight:'800' }}>Refresh</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={doEnsure} style={{ backgroundColor:'#22c55e', padding:8, borderRadius:8, alignSelf:'flex-start' }}>
        <Text style={{ color:'#000', fontWeight:'800' }}>Upsert now (ensureUser)</Text>
      </TouchableOpacity>
      {msg ? <Text style={{ color:'tomato' }}>{msg}</Text> : null}

      <Text style={{ color:'#94a3b8' }}>session: {JSON.stringify(session)?.slice(0,4000)}</Text>
      <Text style={{ color:'#94a3b8' }}>user: {JSON.stringify(user)?.slice(0,4000)}</Text>
      <Text style={{ color:'#94a3b8' }}>users row: {JSON.stringify(usersRow)}</Text>
      <Text style={{ color:'#94a3b8' }}>profiles row: {JSON.stringify(profilesRow)}</Text>
    </ScrollView>
  );
}
