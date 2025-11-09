import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { SUPABASE_URL, SUPABASE_ANON_KEY, validateEnv } from './env';
import AsyncStorage from '@react-native-async-storage/async-storage';

validateEnv();

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
