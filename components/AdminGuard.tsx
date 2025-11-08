'use client';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { ADMIN_EMAILS } from '../constants/admin';

function normalizeEmails(list: string[]) {
  return new Set(list.map(e => String(e || '').trim().toLowerCase()));
}

<<<<<<< HEAD
export default function AdminGuard({ children }: { children: JSX.Element }) {
=======
export default function AdminGuard({ children }:{ children: JSX.Element }) {
>>>>>>> origin/main
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const adminSet = normalizeEmails(ADMIN_EMAILS);

    async function load() {
      try {
<<<<<<< HEAD
        const { data: sessionData } = await supabase.auth.getSession();
        const sess = sessionData?.session || null;
=======
        // 1) Ensure we actually have a session (preview domains change on Replit)
        const { data: sessionData } = await supabase.auth.getSession();
        const sess = sessionData?.session || null;

        // 2) If no session, see if user is retrievable anyway
>>>>>>> origin/main
        const { data: userData } = await supabase.auth.getUser();
        const u = userData?.user || sess?.user || null;

        const detectedEmail = String(u?.email || '').trim();
        setEmail(detectedEmail);

        // Dev bypass (web only): localStorage.ADMIN_BYPASS = '1'
        // @ts-ignore
        const bypass = typeof window !== 'undefined' && window?.localStorage?.getItem('ADMIN_BYPASS') === '1';

        setAllowed(bypass || (detectedEmail && adminSet.has(detectedEmail.toLowerCase())));
<<<<<<< HEAD
      } catch (e: any) {
=======
      } catch (e:any) {
>>>>>>> origin/main
        setErr(e.message || String(e));
        setAllowed(false);
      }
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
<<<<<<< HEAD
=======
      // re-run on login/logout
>>>>>>> origin/main
      load();
    });
    return () => { sub?.subscription?.unsubscribe?.(); };
  }, []);

  if (allowed === null) {
<<<<<<< HEAD
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ color: '#cbd5e1' }}>Checking admin access…</Text>
=======
    return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}>
      <Text style={{ color:'#cbd5e1' }}>Checking admin access…</Text>
>>>>>>> origin/main
    </View>;
  }

  if (!allowed) {
    return (
<<<<<<< HEAD
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 }}>
        <Text style={{ color: 'red', fontWeight: '700' }}>Admin access required</Text>
        <Text style={{ color: '#94a3b8' }}>Signed in as: {email || '— not signed in —'}</Text>
        {err ? <Text style={{ color: '#cbd5e1' }}>{err}</Text> : null}
        <TouchableOpacity
          onPress={() => { try { /* @ts-ignore */ if (window) window.location.href = '/auth'; } catch {} }}
          style={{ backgroundColor: '#0ea5e9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Go to Login</Text>
        </TouchableOpacity>
=======
      <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16, gap:8}}>
        <Text style={{ color:'red', fontWeight:'700' }}>Admin access required</Text>
        <Text style={{ color:'#94a3b8' }}>Signed in as: {email || '— not signed in —'}</Text>
        {err ? <Text style={{ color:'#cbd5e1' }}>{err}</Text> : null}
        <TouchableOpacity
          onPress={() => { try { /* @ts-ignore */ if (window) window.location.href = '/auth'; } catch {} }}
          style={{ backgroundColor:'#0ea5e9', paddingVertical:8, paddingHorizontal:12, borderRadius:8 }}
        >
          <Text style={{ color:'#fff', fontWeight:'800' }}>Go to Login</Text>
        </TouchableOpacity>
        {/* Dev helper: enable bypass in browser console:
            localStorage.setItem('ADMIN_BYPASS','1')
            (refresh to take effect; remove with localStorage.removeItem('ADMIN_BYPASS')) */}
>>>>>>> origin/main
      </View>
    );
  }

  return children;
}
<<<<<<< HEAD

=======
>>>>>>> origin/main
