import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (globalThis as any).__EXPO_SUPABASE_URL ||
  ''; // must be https://<project-ref>.supabase.co

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (globalThis as any).__EXPO_SUPABASE_ANON_KEY ||
  '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail fast; avoids silent 404s to wrong hosts
  console.error('Missing Supabase URL or ANON key', {
    SUPABASE_URL: !!SUPABASE_URL,
    SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY,
  });
}

// Configure auth storage based on platform
// Web: Supabase uses localStorage by default, but we can be explicit
// Native: Use AsyncStorage for session persistence
const authStorage = Platform.OS === 'web' 
  ? undefined // Let Supabase use default localStorage for web
  : AsyncStorage; // Native: use AsyncStorage

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce', // Use PKCE flow for better security
  },
});
