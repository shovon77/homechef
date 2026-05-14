/**
 * Homepage chef distance helpers (Nominatim + caches).
 * Loaded via dynamic import from the homepage so the initial route chunk stays smaller.
 */
import { Platform } from 'react-native'

const coordinateCache = new Map<string, { lat: number; lon: number } | null>()

/** In-memory cache for chef coords from profiles (faster than geocoding) */
export const chefProfileCoordCache = new Map<string, { lat: number; lon: number } | null>()

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('geocode_cache')
    if (cached) {
      const parsed = JSON.parse(cached)
      Object.entries(parsed).forEach(([key, value]: [string, any]) => {
        if (value) {
          coordinateCache.set(key, value)
        }
      })
    }
  } catch (e) {
    console.warn('Failed to load geocode cache:', e)
  }
}

function saveCacheToStorage() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const cacheObj: Record<string, { lat: number; lon: number } | null> = {}
      coordinateCache.forEach((value, key) => {
        cacheObj[key] = value
      })
      localStorage.setItem('geocode_cache', JSON.stringify(cacheObj))
    } catch (e) {
      console.warn('Failed to save geocode cache:', e)
    }
  }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address) return null

  if (coordinateCache.has(address)) {
    return coordinateCache.get(address) ?? null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=0`,
      { headers: { 'User-Agent': 'YourHomeChef/1.0' }, signal: controller.signal }
    )
    clearTimeout(timeoutId)

    if (!response.ok) return null
    const data = await response.json()
    if (data?.[0]) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
      if (!isNaN(coords.lat) && !isNaN(coords.lon)) {
        coordinateCache.set(address, coords)
        saveCacheToStorage()
        return coords
      }
    }
  } catch {
    // timeout or network error — skip silently
  }

  coordinateCache.set(address, null)
  return null
}

/** Max concurrent Nominatim-bound geocode calls for chef addresses (cap, not unbounded). */
export const CHEF_ADDRESS_GEOCODE_POOL = 2

/**
 * Run async work with at most `poolSize` tasks in flight.
 * Safe under JS single-thread scheduling: workers interleave only at `await`.
 */
export async function asyncPool<T>(
  poolSize: number,
  items: readonly T[],
  iteratorFn: (item: T) => Promise<void>
): Promise<void> {
  const n = items.length
  if (n === 0 || poolSize < 1) return
  const workers = Math.min(poolSize, n)
  let index = 0
  const worker = async (): Promise<void> => {
    while (index < n) {
      const i = index++
      await iteratorFn(items[i])
    }
  }
  await Promise.all(Array.from({ length: workers }, worker))
}

export function calculateDistanceFromCoords(
  userCoords: { lat: number; lon: number },
  chefCoords: { lat: number; lon: number }
): number {
  const R = 6371
  const dLat = (chefCoords.lat - userCoords.lat) * Math.PI / 180
  const dLon = (chefCoords.lon - userCoords.lon) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(userCoords.lat * Math.PI / 180) *
      Math.cos(chefCoords.lat * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function normalizeLocationKey(loc: any): string {
  return String(loc || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/,+/g, ',')
}
