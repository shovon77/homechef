'use client';
import { useEffect, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { View, ScrollView } from 'react-native';
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

  // ... existing useEffects ...

  return (
    <CartProvider>
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </CartProvider>
  );
}
