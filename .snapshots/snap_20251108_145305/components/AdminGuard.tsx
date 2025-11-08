'use client';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { ADMIN_EMAILS } from '../constants/admin';

function normalizeEmails(list: string[]) {
  return new Set(list.map(e => String(e || '').trim().toLowerCase()));
}

export default function AdminGuard({ children }: { children: JSX.Element }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const adminSet = normalizeEmails(ADMIN_EMAILS);

    async function load() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sess = sessionData?.session || null;
        const { data: userData } = await supabase.auth.getUser();
        const u = userData?.user || sess?.user || null;

        const detectedEmail = String(u?.email || '').trim();
        setEmail(detectedEmail);

        // Dev bypass (web only): localStorage.ADMIN_BYPASS = '1'
        // @ts-ignore
        const bypass = typeof window !== 'undefined' && window?.localStorage?.getItem('ADMIN_BYPASS') === '1';

        setAllowed(bypass || (detectedEmail && adminSet.has(detectedEmail.toLowerCase())));
      } catch (e: any) {
        setErr(e.message || String(e));
        setAllowed(false);
      }
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      load();
    });
    return () => { sub?.subscription?.unsubscribe?.(); };
  }, []);

  if (allowed === null) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ color: '#cbd5e1' }}>Checking admin access…</Text>
    </View>;
  }

  if (!allowed) {
    return (
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
      </View>
    );
  }

  return children;
}

