'use client';
import { useEffect, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { View, ScrollView, Platform } from 'react-native';
import { ensureUser } from '../lib/ensureUser';
import { ensureProfile } from '../lib/ensureProfile';
import { supabase } from '../lib/supabase';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import { CartProvider } from '../context/CartContext';
import { AuthProvider } from '../context/AuthContext';
import { LocationModalProvider } from '../context/LocationModalContext';
import { redirectAfterLogin } from '../lib/authRedirect';
import { 
  useFonts, 
  OpenSans_300Light,
  OpenSans_400Regular, 
  OpenSans_600SemiBold, 
  OpenSans_700Bold, 
  OpenSans_800ExtraBold 
} from '@expo-google-fonts/open-sans';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const initialized = useRef(false);

  const [fontsLoaded] = useFonts({
    OpenSans_300Light,
    OpenSans_400Regular,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    OpenSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Add favicon to head for web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Remove existing favicon links
      const existingLinks = document.querySelectorAll("link[rel*='icon']");
      existingLinks.forEach(link => link.remove());
      
      // Add new favicon link - try multiple paths for compatibility
      const faviconPaths = [
        '/assets/tablogo.png',
        './assets/tablogo.png',
        '/favicon.png',
        '/_expo/static/assets/tablogo.png',
      ];
      
      faviconPaths.forEach((path, index) => {
        const link = document.createElement('link');
        link.rel = index === 0 ? 'icon' : 'alternate icon';
        link.type = 'image/png';
        link.href = path;
        document.head.appendChild(link);
      });
      
      // Also add apple-touch-icon for better mobile support
      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.href = '/assets/tablogo.png';
      document.head.appendChild(appleLink);
    }
  }, []);

  // Ensure profile and welcome notification on auth state changes
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    async function handleAuthStateChange() {
      try {
        // Check initial session (non-blocking)
        supabase.auth.getSession().then(({ data: sessionData }) => {
          if (sessionData?.session?.user && mounted) {
            // Ensure profile exists (non-blocking - don't wait for welcome notification)
            ensureProfile().catch((err) => {
              console.warn('ensureProfile on initial load error:', err);
            });
          }
        });

        // Subscribe to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (mounted && session?.user) {
            // Ensure profile exists (non-blocking - don't wait for welcome notification)
            ensureProfile().catch((err) => {
              console.warn('ensureProfile on auth state change error:', err);
            });
          }
        });

        unsubscribe = subscription?.unsubscribe?.bind(subscription) || null;
      } catch (e: any) {
        console.warn('Error in auth state change handler:', e?.message || e);
      }
    }

    handleAuthStateChange();

    return () => {
      mounted = false;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (e) {
          // Ignore unsubscribe errors
        }
      }
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <CartProvider>
        <LocationModalProvider>
          <View style={{ flex: 1, backgroundColor: 'white' }}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </LocationModalProvider>
      </CartProvider>
    </AuthProvider>
  );
}
