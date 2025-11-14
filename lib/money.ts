export function cents(value?: number | null): string {
  const v = Number.isFinite(value) ? Number(value) : 0;
  return (v / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export function formatCad(value?: number | null): string {
  const v = Number.isFinite(value) ? Number(value) : 0;
  return v.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}
