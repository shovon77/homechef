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
 * Optimize any image URL (chef avatars, general assets) — same logic, different default size.
 */
export function optimizeImageUrl(uri: string | null | undefined, maxW: number): string {
  return optimizeDishImageUrl(uri, maxW);
}
