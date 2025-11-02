import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../app/env';
function notConfigured(): SupabaseClient {
  const msg = 'Supabase not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Replit → Tools → Secrets, then click Run.';
  // @ts-ignore
  return new Proxy({}, { get() { throw new Error(msg); } }) as SupabaseClient;
}
export const supabase: SupabaseClient =
  (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : notConfigured();
export default supabase;
