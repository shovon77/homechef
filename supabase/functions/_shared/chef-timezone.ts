/**
 * Allowed chef IANA timezones (pickup wall-clock on create-checkout).
 * Keep IDs in sync with lib/chef-timezones.ts CHEF_TIMEZONE_OPTIONS.
 */
const ALLOWED_CHEF_TIMEZONES = new Set<string>([
  'America/St_Johns',
  'America/Halifax',
  'America/Moncton',
  'America/Toronto',
  'America/Montreal',
  'America/Winnipeg',
  'America/Regina',
  'America/Edmonton',
  'America/Calgary',
  'America/Vancouver',
  'America/Whitehorse',
  'America/Dawson',
  'America/Iqaluit',
  'America/Rankin_Inlet',
  'America/Inuvik',
  'America/Yellowknife',
]);

const DEFAULT_CHEF_TIMEZONE = 'America/Toronto';

export function resolveChefTimezoneId(raw: unknown): string {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t || !ALLOWED_CHEF_TIMEZONES.has(t)) return DEFAULT_CHEF_TIMEZONE;
  return t;
}
