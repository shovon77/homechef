/**
 * Safely convert a value to a fixed decimal string
 * @param value - The value to format (can be undefined, null, or any type)
 * @param digits - Number of decimal places (default: 1)
 * @param fallback - Value to return if value is not a valid number (default: '—')
 * @returns Formatted string or fallback
 */
export function safeToFixed(value: unknown, digits = 1, fallback: string | number = '—'): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : String(fallback);
}

/**
 * Safely convert a value to a number
 * @param value - The value to convert (can be undefined, null, or any type)
 * @param fallback - Value to return if value is not a valid number (default: 0)
 * @returns Number or fallback
 */
export function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Convert a value to a finite number (or null).
 * Unlike Number(x), this will treat null/undefined/'' as "missing" (null),
 * which is important for coordinates (Number(null) === 0 is almost never desired).
 */
export function toFiniteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}