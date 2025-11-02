export function normalizeId(v: string | number) {
  return String(v).replace(/\D+/g, ''); // "S_123" -> "123"
}
