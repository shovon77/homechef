/**
 * Helper function to update user location with geocoding
 * Stores both the location text and coordinates for faster distance calculations
 */

import { supabase } from './supabase';
import { geocodeAddress } from './geocode';
import { toFiniteNumberOrNull } from './number';

export async function updateLocationWithCoordinates(
  userId: string,
  location: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const locationValue = location?.trim() || null;
    let latitude: number | null = null;
    let longitude: number | null = null;

    // Geocode location if provided
    if (locationValue) {
      // Prefer Google geocoding (more accurate for precise addresses),
      // fallback to OSM/Nominatim if the edge function fails.
      try {
        const { data, error } = await supabase.functions.invoke('google-geocode-forward', {
          body: { address: locationValue },
        });

        const lat = toFiniteNumberOrNull((data as any)?.lat);
        const lng = toFiniteNumberOrNull((data as any)?.lng);
        // Guard against Number(null) === 0 causing (0,0) to be saved.
        if (!error && lat !== null && lng !== null) {
          latitude = lat;
          longitude = lng;
        }
      } catch {
        // ignore and fall back
      }

      if (latitude === null || longitude === null) {
        const coords = await geocodeAddress(locationValue);
        if (coords) {
          latitude = coords.lat;
          longitude = coords.lon;
        }
      }
    }

    // Update profile with location and coordinates
    const updateData: {
      location: string | null;
      latitude?: number | null;
      longitude?: number | null;
    } = {
      location: locationValue,
    };

    if (latitude !== null && longitude !== null) {
      updateData.latitude = latitude;
      updateData.longitude = longitude;
    } else if (locationValue === null) {
      // Clear coordinates if location is cleared
      updateData.latitude = null;
      updateData.longitude = null;
    } else {
      // If location changed but we couldn't geocode, clear coords to avoid using stale values.
      updateData.latitude = null;
      updateData.longitude = null;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('Error updating location with coordinates:', error);
    return { ok: false, error: error.message || 'Failed to update location' };
  }
}
