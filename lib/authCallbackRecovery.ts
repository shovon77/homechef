import { supabase } from './supabase';
import { getAuthTypeFromUrl, getPkceCodeFromUrl, getTokenHashFromUrl } from './authUrlErrors';

export type CompleteAuthFromUrlInput = {
  href?: string;
  code?: string | null;
  type?: string | null;
  token_hash?: string | null;
};

export type CompleteAuthFromUrlResult = {
  isRecovery: boolean;
  error: Error | null;
};

function isRecoveryType(type: string | null | undefined): boolean {
  return type === 'recovery' || type === 'PASSWORD_RECOVERY';
}

function pkceVerifierErrorMessage(): string {
  return (
    'This reset link must be opened in the same browser where you requested it. ' +
    'Try again from that browser, or request a new reset email from the login page.'
  );
}

function isPkceVerifierError(error: Error | null | undefined): boolean {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('code verifier') || msg.includes('both auth code and code verifier');
}

/** Exchange PKCE code; returns whether this session is from a password-recovery email. */
async function exchangeCodeForSessionWithRecovery(
  code: string,
  recoveryHint: boolean
): Promise<{ isRecovery: boolean; error: Error | null }> {
  let isRecovery = recoveryHint;

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      isRecovery = true;
    }
  });

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (isPkceVerifierError(error)) {
        return { isRecovery, error: new Error(pkceVerifierErrorMessage()) };
      }
      return { isRecovery, error };
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    return { isRecovery, error: null };
  } finally {
    subscription.unsubscribe();
  }
}

/**
 * Complete sign-in / recovery from callback URL params.
 * Prefers token_hash + verifyOtp (works when email opens in a different browser).
 * Falls back to PKCE code exchange (same browser as "Forgot password").
 */
export async function completeAuthFromUrl(input: CompleteAuthFromUrlInput): Promise<CompleteAuthFromUrlResult> {
  const href = input.href || (typeof window !== 'undefined' ? window.location.href : '');
  const type = input.type ?? getAuthTypeFromUrl(href);
  const tokenHash = input.token_hash ?? getTokenHashFromUrl(href);
  const code = input.code ?? getPkceCodeFromUrl(href);
  const recoveryHint = isRecoveryType(type);

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'recovery' | 'email' | 'signup' | 'invite' | 'magiclink' | 'email_change',
    });
    if (error) {
      return { isRecovery: recoveryHint, error };
    }
    return { isRecovery: recoveryHint, error: null };
  }

  if (code) {
    return exchangeCodeForSessionWithRecovery(code, recoveryHint);
  }

  return {
    isRecovery: false,
    error: new Error('Missing authentication parameters. Please try the link again or request a new reset email.'),
  };
}
