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

  // ... existing useEffects ...

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
