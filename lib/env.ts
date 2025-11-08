export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function validateEnv() {
  if (!SUPABASE_URL) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
  if (!/^https?:\/\//.test(SUPABASE_URL)) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must start with http:// or https://');
  }
  if (!SUPABASE_ANON_KEY) throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
}
