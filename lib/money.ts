export function cents(value?: number | null): string {
  const v = Number.isFinite(value) ? Number(value) : 0;
  return (v / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}
