/**
 * Dish hero / card image URL tuned for max width (fewer bytes on mobile).
 */
export function optimizeDishImageUrl(uri: string | null | undefined, maxW: number): string {
  const w = Math.max(320, Math.min(maxW, 2048));
  const fallback = `https://images.unsplash.com/photo-1551218808-94e220e084d2?w=${w}&q=72&auto=format&fit=crop`;
  if (!uri?.trim()) return fallback;
  const raw = uri.trim();
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
