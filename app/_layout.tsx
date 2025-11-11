'use client';
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, Platform } from 'react-native';
import { ensureUser } from '../lib/ensureUser';
import { ensureProfile } from '../lib/ensureProfile';
import { supabase } from '../lib/supabase';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import { CartProvider } from '../context/CartContext';

export default function RootLayout() {
  useEffect(() => {
    let unsub: any;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          const res = await ensureUser();
          if (!res.ok) console.warn('ensureUser on load:', res.error);
          const profileRes = await ensureProfile();
          if (!profileRes.ok) console.warn('ensureProfile on load:', profileRes.error);
        }
        const sub = supabase.auth.onAuthStateChange(async (_evt, sess) => {
          if (sess?.user) {
            const res = await ensureUser();
            if (!res.ok) console.warn('ensureUser on change:', res.error);
            const profileRes = await ensureProfile();
            if (!profileRes.ok) console.warn('ensureProfile on change:', profileRes.error);
          }
        });
        unsub = sub?.data?.subscription?.unsubscribe?.bind(sub?.data?.subscription);
      } catch (e: any) {
        console.warn('ensureUser/ensureProfile effect error:', e?.message || e);
      }
    })();
    return () => { try { unsub?.(); } catch { /* noop */ } };
  }, []);

  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    async function resolveAndNav(idx: number) {
      const { data, error } = await supabase
        .from('chefs')
        .select('id')
        .order('id', { ascending: true })
        .range(idx, idx);
      const realId = data?.[0]?.id;
      if (error) console.warn('resolve chef error', error);
      if (realId) router.replace('/chef/' + realId);
    }
    function onClick(e: MouseEvent) {
      const link = (e.target as HTMLElement)?.closest?.('a');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const match = href.match(/^\/chef\/s_(\d+)$/);
      if (match) {
        e.preventDefault();
        const idx = Number(match[1]);
        if (Number.isFinite(idx)) resolveAndNav(idx);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [router]);

  return (
    <CartProvider>
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <NavBar />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
        <Footer />
      </View>
    </CartProvider>
  );
}
