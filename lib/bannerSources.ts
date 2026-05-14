/**
 * Homepage hero banner URLs: optional modern formats + fallbacks.
 *
 * - Supabase Storage `.../object/public/...`: uses image render API + explicit WebP
 *   (`format=webp`) with origin bytes as `<img>` fallback. Uses `resize=contain` so
 *   the CDN does not crop before the hero applies `object-fit: cover` / native cover.
 * - Optional `app_settings` keys `banner_url_webp` / `banner_url_avif` for any host
 *   when you control separate assets (e.g. CDN WebP/AVIF next to a JPEG fallback).
 * - `lh3.googleusercontent.com`: still only one URL (no format negotiation); optional
 *   explicit WebP/AVIF keys apply if you host variants elsewhere.
 * - Unsplash: single optimized URL with `auto=format` (browser already negotiates).
 */

export type BannerPictureSources = {
  fallback: string
  webp: string | null
  avif: string | null
}

function bannerTargetWidthPx(viewportWidth: number): number {
  return Math.min(Math.ceil(viewportWidth * 2), 3000)
}

/** Resize googleusercontent banner URLs to match viewport (2x for retina, capped at 3000). */
export function sizeBannerUrl(url: string, viewportWidth: number): string {
  if (!url.includes('googleusercontent.com')) return url
  const px = bannerTargetWidthPx(viewportWidth)
  if (url.match(/=s\d+$/)) return url.replace(/=s\d+$/, `=s${px}`)
  if (!url.includes('=')) return `${url}=s${px}`
  return url
}

function supabaseRenderBaseFromObjectUrl(objectUrl: string, viewportWidth: number): string | null {
  if (!objectUrl.includes('.supabase.co/storage/v1/object/')) return null
  const transformed = objectUrl.replace('/storage/v1/object/', '/storage/v1/render/image/')
  const w = bannerTargetWidthPx(viewportWidth)
  const sep = transformed.includes('?') ? '&' : '?'
  // `contain` preserves the full image at ~retina width; hero applies one `cover` pass.
  // (`resize=cover` on the CDN + `object-fit: cover` looked doubly zoomed.)
  return `${transformed}${sep}width=${w}&quality=80&resize=contain`
}

function optimizeUnsplashBanner(url: string, viewportWidth: number): string {
  try {
    const u = new URL(url)
    const w = bannerTargetWidthPx(viewportWidth)
    u.searchParams.set('w', String(w))
    u.searchParams.set('q', '72')
    u.searchParams.set('auto', 'format')
    u.searchParams.set('fit', 'max')
    return u.toString()
  } catch {
    return url
  }
}

export type BannerSourceOptions = {
  /** Optional full URL to a WebP asset (e.g. second row in `app_settings`). */
  explicitWebp?: string | null
  /** Optional full URL to an AVIF asset. */
  explicitAvif?: string | null
}

/**
 * URLs for `<picture>` on web (`source` + `<img src={fallback}>`) and a single
 * `fallback` for React Native `Image`.
 */
export function getBannerPictureSources(
  rawMainUrl: string,
  viewportWidth: number,
  opts?: BannerSourceOptions
): BannerPictureSources {
  const main = rawMainUrl.trim()
  if (!main) {
    return { fallback: '', webp: null, avif: null }
  }

  const explicitWebp = opts?.explicitWebp?.trim() || null
  const explicitAvif = opts?.explicitAvif?.trim() || null

  if (explicitAvif) {
    return {
      avif: sizeBannerUrl(explicitAvif, viewportWidth),
      webp: explicitWebp ? sizeBannerUrl(explicitWebp, viewportWidth) : null,
      fallback: sizeBannerUrl(main, viewportWidth),
    }
  }
  if (explicitWebp) {
    return {
      avif: null,
      webp: sizeBannerUrl(explicitWebp, viewportWidth),
      fallback: sizeBannerUrl(main, viewportWidth),
    }
  }

  const renderBase = supabaseRenderBaseFromObjectUrl(main, viewportWidth)
  if (renderBase) {
    const sep = renderBase.includes('?') ? '&' : '?'
    return {
      fallback: renderBase,
      webp: `${renderBase}${sep}format=webp`,
      avif: null,
    }
  }

  if (main.includes('images.unsplash.com')) {
    return {
      fallback: optimizeUnsplashBanner(main, viewportWidth),
      webp: null,
      avif: null,
    }
  }

  return {
    fallback: sizeBannerUrl(main, viewportWidth),
    webp: null,
    avif: null,
  }
}
