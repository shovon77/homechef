import { ensureUser } from '../lib/ensureUser';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';
'use client';
import { Stack } from 'expo-router';
import { View, Platform } from 'react-native';
import NavBar from '../components/NavBar';

export default function RootLayout() {
// __ensureUserEffect: keep users/profiles synced with auth
useEffect(() => {
  let unsub:any;
  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        const res = await ensureUser();
        if (!res.ok) console.warn('ensureUser on load:', res.error);
      }
      const sub = supabase.auth.onAuthStateChange(async (_evt, sess) => {
        if (sess?.user) {
          const res = await ensureUser();
          if (!res.ok) console.warn('ensureUser on change:', res.error);
        }
      });
      unsub = sub?.data?.subscription?.unsubscribe?.bind(sub?.data?.subscription);
    } catch (e:any) {
      console.warn('ensureUser effect error:', e?.message || e);
    }
  })();
  return () => { try { unsub?.(); } catch {} };
}, []);

  const router = typeof useRouter === 'function' ? useRouter() : undefined;

  // Web-only: intercept links like /chef/s_0 and redirect to /chef/<numericId>
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    async function resolveAndNav(idx) {
      const { data, error } = await supabase
        .from('chefs')
        .select('id')
        .order('id',{ ascending:true })
        .range(idx, idx);
      const realId = data?.[0]?.id;
      if (realId) router?.replace('/chef/' + realId);
    }
    function onClick(e) {
      const a = (e.target as HTMLElement)?.closest?.('a');
      if (!a) return;
      const href = (a.getAttribute('href')||'');
      // only intercept chef links in the s_<n> format
      const m = href.match(/^\/chef\/s_(\d+)$/);
      if (m) {
        e.preventDefault();
        const idx = Number(m[1]);
        if (Number.isFinite(idx)) resolveAndNav(idx);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <NavBar />
      <Stack
        screenOptions={{
          headerShown: false, // hide expo-router's default headers
        }}
      />
    </View>
  );
}
