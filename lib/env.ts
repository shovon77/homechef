const ENV = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  WEB_BASE_URL: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'http://localhost:8081',
};

export function validateEnv() {
  if (!ENV.SUPABASE_URL) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
  if (!/^https?:\/\//.test(ENV.SUPABASE_URL)) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must start with http:// or https://');
  }
  if (!ENV.SUPABASE_ANON_KEY) throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export default ENV;
