/**
 * Geocoding utility for converting addresses to coordinates
 * Uses OpenStreetMap Nominatim API with caching and retry logic
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { toFiniteNumberOrNull } from './number';

// Coordinate cache with persistent storage
const coordinateCache = new Map<string, { lat: number; lon: number } | null>();

// Load cache from localStorage on initialization
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('geocode_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.entries(parsed).forEach(([key, value]: [string, any]) => {
        if (value) {
          coordinateCache.set(key, value);
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load geocode cache:', e);
  }
}

// Save cache to localStorage
function saveCacheToStorage() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const cacheObj: Record<string, { lat: number; lon: number } | null> = {};
      coordinateCache.forEach((value, key) => {
        cacheObj[key] = value;
      });
      localStorage.setItem('geocode_cache', JSON.stringify(cacheObj));
    } catch (e) {
      console.warn('Failed to save geocode cache:', e);
    }
  }
}

function cacheCoords(address: string, coords: { lat: number; lon: number }) {
  coordinateCache.set(address, coords);
  saveCacheToStorage();
}

/**
 * Resolve an address to coordinates using Google Geocoding (via edge function),
 * falling back to OpenStreetMap Nominatim when needed.
 */
export async function resolveAddressCoords(
  address: string,
): Promise<{ lat: number; lon: number } | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  if (coordinateCache.has(trimmed)) {
    const cached = coordinateCache.get(trimmed);
    if (cached) return cached;
  }

  try {
    const { data, error } = await supabase.functions.invoke('google-geocode-forward', {
      body: { address: trimmed },
    });

    const lat = toFiniteNumberOrNull((data as { lat?: unknown })?.lat);
    const lng = toFiniteNumberOrNull((data as { lng?: unknown })?.lng);
    if (!error && lat !== null && lng !== null) {
      const coords = { lat, lon: lng };
      cacheCoords(trimmed, coords);
      return coords;
    }
  } catch {
    // Fall back to Nominatim below.
  }

  return geocodeAddress(trimmed);
}

/**
 * Geocode an address to coordinates with persistent caching and retry logic
 * @param address - The address string to geocode
 * @param retries - Number of retry attempts (default: 2)
 * @returns Coordinates object with lat/lon or null if geocoding fails
 */
export async function geocodeAddress(address: string, retries = 2): Promise<{ lat: number; lon: number } | null> {
  if (!address) return null;
  
  // Check in-memory cache first
  if (coordinateCache.has(address)) {
    const cached = coordinateCache.get(address);
    if (cached) return cached; // Only return if we have valid coordinates
    // If cached as null, don't retry immediately (was a persistent failure)
    // But allow one retry attempt
  }

  // Try different address formats
  const addressVariants = [
    address, // Full address first
    address.split(',').slice(0, 2).join(',').trim(), // City, State
    address.split(',')[0]?.trim(), // Just city
  ].filter((v, i, arr) => v && arr.indexOf(v) === i); // Remove duplicates

  for (let variantIndex = 0; variantIndex < addressVariants.length; variantIndex++) {
    const addressToTry = addressVariants[variantIndex];
    
    // Check cache for this variant
    if (coordinateCache.has(addressToTry)) {
      const cached = coordinateCache.get(addressToTry);
      if (cached) {
        // Cache the result for the original address too
        coordinateCache.set(address, cached);
        saveCacheToStorage();
        return cached;
      }
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const encodedAddress = encodeURIComponent(addressToTry);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=0`,
          {
            headers: {
              'User-Agent': 'YourHomeChef/1.0'
            },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Geocoding failed: ${response.status}`);
        }
        
        const data = await response.json();
        if (data && data.length > 0) {
          const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
          // Validate coordinates
          if (isNaN(coords.lat) || isNaN(coords.lon)) {
            throw new Error('Invalid coordinates returned');
          }
          // Cache for both the variant and original address
          coordinateCache.set(addressToTry, coords);
          coordinateCache.set(address, coords);
          saveCacheToStorage();
          return coords;
        }
        
        // If no results, try next variant or retry
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between retries
          continue;
        }
        
        // This variant failed, try next one
        break;
      } catch (error: any) {
        if (attempt === retries) {
          // Final attempt for this variant failed, try next variant
          if (variantIndex === addressVariants.length - 1) {
            // All variants failed
            if (error.name === 'AbortError') {
              console.warn('Geocoding timeout for:', address);
            } else {
              console.warn('Geocoding error for:', address, error);
            }
            // Don't cache failures - allow retry on next load
            return null;
          }
          break; // Try next variant
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }
  
  return null;
}
