/**
 * Dish / chef image URL tuned for max width (fewer bytes on mobile).
 *
 * Supabase Storage: replaces `/object/` with `/render/image/` and appends
 * `?width=W&quality=75&resize=cover` so the CDN serves a resized JPEG/WebP.
 * Requires Pro Plan image transformations to be enabled; degrades gracefully
 * (returns original image) if not.
 *
 * Unsplash: sets `w`, `q`, `auto=format`, `fit=crop` query params.
 *
 * Other URLs: returned unchanged.
 */
export function optimizeDishImageUrl(uri: string | null | undefined, maxW: number): string {
  const w = Math.max(320, Math.min(maxW, 2048));
  const fallback = `https://images.unsplash.com/photo-1551218808-94e220e084d2?w=${w}&q=72&auto=format&fit=crop`;
  if (!uri?.trim()) return fallback;
  const raw = uri.trim();

  // Supabase Storage URLs
  if (raw.includes('.supabase.co/storage/v1/object/')) {
    const transformed = raw.replace(
      '/storage/v1/object/',
      '/storage/v1/render/image/'
    );
    const sep = transformed.includes('?') ? '&' : '?';
    return `${transformed}${sep}width=${w}&quality=75&resize=cover`;
  }

  // Unsplash
  if (raw.includes('images.unsplash.com')) {
    try {
      const url = new URL(raw);
      url.searchParams.set('w', String(w));
      url.searchParams.set('q', '72');
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      return url.toString();
    } catch {
      return raw;
    }
  }

  return raw;
}

/**
 * Bounding-box resize with `contain` (no server-side `cover` crop).
 * Used for dish **detail hero** and **DishCard** thumbnails; pass max edge (hero: viewport-based, cards: ~480).
 * The UI still uses `resizeMode="cover"` so the frame is filled on device.
 *
 * Supabase: `width` + `height` + `resize=contain` inside a square box capped by `maxDimension`.
 * Unsplash: `w` + `h` + `fit=max` (fit within bounds, preserve aspect).
 */
export function optimizeDishDetailHeroUrl(uri: string | null | undefined, maxDimension: number): string {
  const d = Math.max(320, Math.min(maxDimension, 2048));
  const fallback = `https://images.unsplash.com/photo-1551218808-94e220e084d2?w=${d}&h=${d}&q=72&auto=format&fit=max`;
  if (!uri?.trim()) return fallback;
  const raw = uri.trim();

  if (raw.includes('.supabase.co/storage/v1/object/')) {
    const transformed = raw.replace(
      '/storage/v1/object/',
      '/storage/v1/render/image/'
    );
    const sep = transformed.includes('?') ? '&' : '?';
    return `${transformed}${sep}width=${d}&height=${d}&resize=contain&quality=75`;
  }

  if (raw.includes('images.unsplash.com')) {
    try {
      const url = new URL(raw);
      url.searchParams.set('w', String(d));
      url.searchParams.set('h', String(d));
      url.searchParams.set('q', '72');
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'max');
      return url.toString();
    } catch {
      return raw;
    }
  }

  return raw;
}

/** Alias: dish cards on home, browse, and chef pages (`DishCard`). Same URL pipeline as `optimizeDishDetailHeroUrl`. */
export const optimizeDishCardImageUrl = optimizeDishDetailHeroUrl;

/**
 * Optimize any image URL (chef avatars, general assets) — same logic, different default size.
 */
export function optimizeImageUrl(uri: string | null | undefined, maxW: number): string {
  return optimizeDishImageUrl(uri, maxW);
}
