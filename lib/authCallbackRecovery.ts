import { supabase } from './supabase';

/** Exchange PKCE code; returns whether this session is from a password-recovery email. */
export async function exchangeCodeForSessionWithRecovery(code: string): Promise<{
  isRecovery: boolean;
  error: Error | null;
}> {
  let isRecovery = false;
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      isRecovery = true;
    }
  });

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { isRecovery, error: error ?? null };
  } finally {
    subscription.unsubscribe();
  }
}
