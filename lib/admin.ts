/**
 * Admin detection utilities
 * 
 * Two ways to grant admin access:
 * (a) Add email to EXPO_PUBLIC_ADMIN_EMAILS (convenience / dev only)
 *    Example: EXPO_PUBLIC_ADMIN_EMAILS=you@domain.com,other@domain.com
 * (b) Set profiles.is_admin = true in the DB (production-safe)
 * 
 * Note: RLS should enforce server-side admin on write paths.
 * See docs/admin.md for more details.
 */

/**
 * Parse comma-separated admin emails from environment variable
 * @returns Set of normalized (lowercase, trimmed) email addresses
 */
export function parseAdminEmails(): Set<string> {
  const envValue = process.env.EXPO_PUBLIC_ADMIN_EMAILS;
  if (!envValue) return new Set();
  
  return new Set(
    envValue
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0)
  );
}

/**
 * Check if a user is a local admin based on email allow-list
 * @param user User object with email property
 * @returns true if user.email is in EXPO_PUBLIC_ADMIN_EMAILS (case-insensitive)
 */
export function isLocalAdmin(user: { email?: string | null } | null | undefined): boolean {
  if (!user?.email) return false;
  
  const adminEmails = parseAdminEmails();
  return adminEmails.has(user.email.trim().toLowerCase());
}

