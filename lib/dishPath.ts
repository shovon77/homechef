/**
 * Human-friendly dish URLs: /dish/mejbani-beef-119
 * The trailing id is authoritative; the slug is cosmetic (SEO + readability).
 * Legacy /dish/119 URLs keep working because resolution is by trailing id.
 */

const MAX_SLUG_LENGTH = 60;

/** "Mejbani beef!" -> "mejbani-beef". Returns '' when nothing usable remains. */
export function slugifyDishName(name: string | null | undefined): string {
  const slug = String(name ?? '')
    .normalize('NFD')
    // Strip diacritics (é -> e) so URLs stay plain ASCII
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  return slug;
}

/** Canonical path for a dish. Falls back to /dish/<id> when the name yields no slug. */
export function dishPath(dish: { id: number | string; name?: string | null }): string {
  const id = String(dish.id);
  const slug = slugifyDishName(dish.name);
  return slug ? `/dish/${slug}-${id}` : `/dish/${id}`;
}

/**
 * Extract the dish id from a route param.
 * Accepts "119" (legacy), "mejbani-beef-119" (canonical), and falls back to the
 * first number for any other legacy form. The TRAILING number wins so dish names
 * containing digits (e.g. "2pc-chicken-119") parse correctly.
 */
export function parseDishIdParam(raw: string | null | undefined): number {
  const s = String(raw ?? '').trim();
  if (!s) return NaN;
  if (/^\d+$/.test(s)) return Number(s);
  const trailing = s.match(/-(\d+)$/);
  if (trailing) return Number(trailing[1]);
  const first = s.match(/(\d+)/);
  return first ? Number(first[1]) : NaN;
}
