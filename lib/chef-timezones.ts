/** Canadian IANA zones for pickup wall-clock; keep in sync with supabase/functions/_shared/chef-timezone.ts */
export const DEFAULT_CHEF_TIMEZONE = 'America/Toronto';

export const CHEF_TIMEZONE_OPTIONS: readonly { id: string; label: string }[] = [
  { id: 'America/St_Johns', label: "Newfoundland (St. John's)" },
  { id: 'America/Halifax', label: 'Atlantic (Halifax)' },
  { id: 'America/Moncton', label: 'Atlantic (Moncton)' },
  { id: 'America/Toronto', label: 'Eastern — Ontario & western Quebec (Toronto, Ottawa)' },
  { id: 'America/Montreal', label: 'Eastern — Montreal' },
  { id: 'America/Winnipeg', label: 'Central — Manitoba (Winnipeg)' },
  { id: 'America/Regina', label: 'Central — Saskatchewan (no DST)' },
  { id: 'America/Edmonton', label: 'Mountain — Alberta (Edmonton)' },
  { id: 'America/Calgary', label: 'Mountain — Alberta (Calgary)' },
  { id: 'America/Vancouver', label: 'Pacific — British Columbia (Vancouver)' },
  { id: 'America/Whitehorse', label: 'Pacific — Yukon' },
  { id: 'America/Dawson', label: 'Pacific — Dawson' },
  { id: 'America/Iqaluit', label: 'Eastern — Nunavut (Iqaluit)' },
  { id: 'America/Rankin_Inlet', label: 'Central — Nunavut (Rankin Inlet)' },
  { id: 'America/Inuvik', label: 'Mountain — NWT (Inuvik)' },
  { id: 'America/Yellowknife', label: 'Mountain — NWT (Yellowknife)' },
] as const;

const ALLOWED = new Set(CHEF_TIMEZONE_OPTIONS.map((o) => o.id));

export function isValidChefTimezoneId(id: string | null | undefined): boolean {
  const t = (id ?? '').trim();
  return ALLOWED.has(t);
}

export function resolveChefTimezoneId(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (!isValidChefTimezoneId(t)) return DEFAULT_CHEF_TIMEZONE;
  return t;
}

export function chefTimezoneLabel(id: string): string {
  const resolved = resolveChefTimezoneId(id);
  return CHEF_TIMEZONE_OPTIONS.find((o) => o.id === resolved)?.label ?? resolved;
}
