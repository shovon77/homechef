import React, { createElement } from 'react'

type Props = {
  fallbackSrc: string
  webpSrc: string | null
  avifSrc: string | null
  isMobile: boolean
}

/**
 * Web-only hero media: `<picture>` so browsers can pick AVIF/WebP when offered,
 * with a safe fallback for `<img>` (and LCP when `fetchPriority` is high).
 */
export function HomeHeroBannerWeb({ fallbackSrc, webpSrc, avifSrc, isMobile }: Props) {
  const objectPosition = isMobile ? 'left center' : 'center center'
  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition,
    pointerEvents: 'none',
  }
  const wrapStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  }

  const children: React.ReactNode[] = []
  if (avifSrc) {
    children.push(createElement('source', { key: 'avif', srcSet: avifSrc, type: 'image/avif' }))
  }
  if (webpSrc) {
    children.push(createElement('source', { key: 'webp', srcSet: webpSrc, type: 'image/webp' }))
  }
  children.push(
    createElement('img', {
      key: 'img',
      src: fallbackSrc,
      alt: '',
      decoding: 'async',
      fetchPriority: 'high',
      loading: 'eager',
      style: imgStyle,
      draggable: false,
    })
  )

  return createElement('picture', { style: wrapStyle }, ...children)
}
