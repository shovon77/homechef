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

export function authErrorToLoginMessage(error: SupabaseAuthUrlError): string {
  if (error.error_code === 'otp_expired') {
    return 'This reset link is invalid or has expired. Request a new link below.';
  }
  if (error.error === 'access_denied') {
    return error.error_description?.replace(/\+/g, ' ') || 'Sign-in link was denied or expired.';
  }
  return error.error_description?.replace(/\+/g, ' ') || 'Authentication failed. Please try again.';
}
