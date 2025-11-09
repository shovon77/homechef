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

