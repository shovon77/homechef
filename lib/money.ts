export function cents(value?: number | null): string {
  const v = Number.isFinite(value) ? Number(value) : 0;
  return (v / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export function formatCad(value?: number | null): string {
  const v = Number.isFinite(value) ? Number(value) : 0;
  return v.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

/** Parse a chef-entered dollar amount (e.g. "5", "$5.50") for storage. */
export function parseCadDollarsInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function formatCadDollarsInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return String(Number(value));
}
