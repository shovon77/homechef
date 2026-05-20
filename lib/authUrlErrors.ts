/** Parse Supabase auth errors returned on the Site URL (query or hash). */
export type SupabaseAuthUrlError = {
  error: string;
  error_code?: string;
  error_description?: string;
};

export function parseSupabaseAuthUrlErrors(href: string): SupabaseAuthUrlError | null {
  try {
    const url = new URL(href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const get = (key: string) => url.searchParams.get(key) || hashParams.get(key);
    const error = get('error');
    if (!error) return null;
    return {
      error,
      error_code: get('error_code') || undefined,
      error_description: get('error_description') || undefined,
    };
  } catch {
    return null;
  }
}

/** PKCE `code` may appear in query or hash when Supabase lands on the wrong path. */
export function getPkceCodeFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    return url.searchParams.get('code') || hashParams.get('code');
  } catch {
    return null;
  }
}

/** Supabase adds `type=recovery` on password-reset email links (query or hash). */
export function getAuthTypeFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    return url.searchParams.get('type') || hashParams.get('type');
  } catch {
    return null;
  }
}

export function isPasswordRecoveryFromUrl(href: string): boolean {
  const type = getAuthTypeFromUrl(href);
  return type === 'recovery' || type === 'PASSWORD_RECOVERY';
}

/** `token_hash` from email recovery links (no PKCE verifier required). */
export function getTokenHashFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    return url.searchParams.get('token_hash') || hashParams.get('token_hash');
  } catch {
    return null;
  }
}

/** Build `/auth/callback` preserving auth params from the landing URL. */
export function buildAuthCallbackUrl(href: string): string | null {
  const code = getPkceCodeFromUrl(href);
  const tokenHash = getTokenHashFromUrl(href);
  const type = getAuthTypeFromUrl(href);
  if (!code && !tokenHash) return null;

  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (tokenHash) params.set('token_hash', tokenHash);
  if (type) params.set('type', type);
  return `/auth/callback?${params.toString()}`;
}

export function authErrorToLoginMessage(error: SupabaseAuthUrlError): string {
  if (error.error_code === 'otp_expired') {
    return 'This reset link is invalid or has expired. Request a new link below.';
  }
  if (error.error === 'access_denied') {
    return error.error_description?.replace(/\+/g, ' ') || 'Sign-in link was denied or expired.';
  }
  return error.error_description?.replace(/\+/g, ' ') || 'Authentication failed. Please try again.';
}
