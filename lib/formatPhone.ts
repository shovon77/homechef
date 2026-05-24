export function formatPhone(v?: string | null) {
  const d = String(v || '').replace(/\D+/g,'');
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return v || '';
}

export function normalizeCanadianPhoneTenDigits(input: string): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return '';
}

/** Canadian NANP (+1): 10 digits; area code and exchange cannot start with 0/1. */
export function isValidCanadianPhone(input: string): boolean {
  const ten = normalizeCanadianPhoneTenDigits(input);
  if (!ten) return false;
  const areaFirst = ten[0];
  const exchangeFirst = ten[3];
  if (!areaFirst || !exchangeFirst) return false;
  if (areaFirst < '2' || exchangeFirst < '2') return false;
  return true;
}

export function toCanadianPhoneE164(input: string): string {
  const ten = normalizeCanadianPhoneTenDigits(input);
  return ten ? `+1${ten}` : '';
}
