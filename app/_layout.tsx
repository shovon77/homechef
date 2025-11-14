'use client';
import { useEffect, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { View } from 'react-native';
import { ensureUser } from '../lib/ensureUser';
import { ensureProfile } from '../lib/ensureProfile';
import { supabase } from '../lib/supabase';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import { CartProvider } from '../context/CartContext';
import { redirectAfterLogin } from '../lib/authRedirect';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const initialized = useRef(false);

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
        const sub = supabase.auth.onAuthStateChange(async (evt, sess) => {
          if (sess?.user) {
            const res = await ensureUser();
            if (!res.ok) console.warn('ensureUser on change:', res.error);
            const profileRes = await ensureProfile();
            if (!profileRes.ok) console.warn('ensureProfile on change:', profileRes.error);
            // Only redirect on SIGNED_IN event and only if user is on login/auth pages
            // Don't redirect on TOKEN_REFRESHED or other events that happen on page refresh
            const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
            if (evt === 'SIGNED_IN' && currentPath && (currentPath.startsWith('/login') || currentPath.startsWith('/auth'))) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin, is_chef, role')
                .eq('id', sess.user.id)
                .maybeSingle();
              redirectAfterLogin(profile ?? {});
            }
          }
        });
        unsub = sub?.data?.subscription?.unsubscribe?.bind(sub?.data?.subscription);
      } catch (e: any) {
        console.warn('ensureUser/ensureProfile effect error:', e?.message || e);
      }
    })();
    return () => { try { unsub?.(); } catch { /* noop */ } };
  }, [pathname]);

  useEffect(() => {
    (async () => {
      if (initialized.current) return;
      initialized.current = true;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      if (pathname && (pathname.startsWith('/login') || pathname.startsWith('/auth'))) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin, is_chef, role')
          .eq('id', session.user.id)
          .maybeSingle();
        redirectAfterLogin(profile ?? {});
      }
    })();
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
