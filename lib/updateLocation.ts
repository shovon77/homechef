/**
 * Helper function to update user location with geocoding
 * Stores both the location text and coordinates for faster distance calculations
 */

import { supabase } from './supabase';
import { geocodeAddress } from './geocode';

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
      const coords = await geocodeAddress(locationValue);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lon;
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
