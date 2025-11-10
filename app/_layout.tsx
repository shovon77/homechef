import { ensureUser } from '../lib/ensureUser';
import { ensureProfile } from '../lib/ensureProfile';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';
'use client';
import { Stack } from 'expo-router';
import { View, Platform } from 'react-native';
import NavBar from '../components/NavBar';
import { CartProvider } from '../context/CartContext';
import { NAVBAR_HEIGHT } from '../constants/layout';
import Footer from '../components/Footer';

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
        // Also ensure profile exists (one-shot for returning users)
        const profileRes = await ensureProfile();
        if (!profileRes.ok) console.warn('ensureProfile on load:', profileRes.error);
      }
      const sub = supabase.auth.onAuthStateChange(async (_evt, sess) => {
        if (sess?.user) {
          const res = await ensureUser();
          if (!res.ok) console.warn('ensureUser on change:', res.error);
          // Ensure profile on auth state change
          const profileRes = await ensureProfile();
          if (!profileRes.ok) console.warn('ensureProfile on change:', profileRes.error);
        }
      });
      unsub = sub?.data?.subscription?.unsubscribe?.bind(sub?.data?.subscription);
    } catch (e:any) {
      console.warn('ensureUser/ensureProfile effect error:', e?.message || e);
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
    <CartProvider>
      <View style={{ flex: 1, minHeight: Platform.OS === 'web' ? '100vh' : undefined }}>
        <NavBar />
        <View
          style={{
            flex: 1,
            paddingTop: Platform.OS === 'web' ? NAVBAR_HEIGHT : 0,
          }}
        >
          <Stack
            screenOptions={{
              headerShown: false, // hide expo-router's default headers
            }}
          />
        </View>
        <Footer />
      </View>
    </CartProvider>
  );
}
