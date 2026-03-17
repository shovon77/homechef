/**
 * Generate a URL-safe slug from a string (e.g. chef name or brand).
 * Lowercase, replace spaces/slashes with hyphens, strip other non-alphanumeric.
 */
export function slugify(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'chef';
}

/**
 * Ensure unique slug by appending numeric id when needed.
 * Caller can pass existing slugs to avoid collisions.
 */
export function uniqueSlug(baseSlug: string, id: number, existingSlugs?: Set<string>): string {
  let slug = baseSlug || 'chef';
  const used = existingSlugs ?? new Set<string>();
  if (!used.has(slug)) return slug;
  let candidate = `${slug}-${id}`;
  let n = 1;
  while (used.has(candidate)) {
    candidate = `${slug}-${id}-${n}`;
    n++;
  }
  return candidate;
}
