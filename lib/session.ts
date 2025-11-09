import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ensures a session is established after sign up or sign in.
 * Polls getSession() up to the specified number of tries with delays.
 * If no session is found, attempts a final sign in and checks again.
 * 
 * @param supabase - Supabase client instance
 * @param email - User email for final sign-in attempt if needed
 * @param password - User password for final sign-in attempt if needed
 * @param tries - Number of polling attempts (default: 20)
 * @returns Session if established, null otherwise
 */
export async function ensureSession(
  supabase: SupabaseClient,
  email: string,
  password: string,
  tries = 20
): Promise<{ access_token: string; refresh_token: string; user: any } | null> {
  // Poll for session
  for (let i = 0; i < tries; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;
    await new Promise(r => setTimeout(r, 150));
  }

  // Final attempt: sign in explicitly
  const si = await supabase.auth.signInWithPassword({ email, password });
  if (si.error) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session ?? null;
}

