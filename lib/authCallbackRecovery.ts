import { supabase } from './supabase';

/** Exchange PKCE code; returns whether this session is from a password-recovery email. */
export async function exchangeCodeForSessionWithRecovery(
  code: string,
  options?: { recoveryHint?: boolean }
): Promise<{
  isRecovery: boolean;
  error: Error | null;
}> {
  let isRecovery = Boolean(options?.recoveryHint);

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      isRecovery = true;
    }
  });

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { isRecovery, error };
    }

    // PASSWORD_RECOVERY may fire synchronously or on the next tick after exchange.
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { isRecovery, error: null };
  } finally {
    subscription.unsubscribe();
  }
}
