'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';
import type { GeoPoint } from '../../lib/delivery-zones';
import {
  DEFAULT_REGION_MAP_VIEW,
  DELIVERY_REGIONS,
  DELIVERY_REGION_PILL_MAX_KM,
  getDeliveryRegionGroupsNearKitchen,
  getDeliveryRegionsNearKitchen,
  regionOutlineToLatLngPath,
} from '../../lib/delivery-region-catalog';

type DeliveryRegionMapPickerProps = {
  selectedRegionIds: string[];
  onToggleRegion: (regionId: string) => void;
  kitchen?: GeoPoint | null;
};

type GoogleMapsNamespace = {
  maps: {
    Map: new (element: HTMLElement, opts: Record<string, unknown>) => GoogleMapInstance;
    Polygon: new (opts: Record<string, unknown>) => GooglePolygonInstance;
    Marker: new (opts: Record<string, unknown>) => GoogleMarkerInstance;
    LatLngBounds: new () => GoogleLatLngBounds;
  };
};

type GoogleMapInstance = {
  panTo: (latLng: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
};

type GoogleLatLngBounds = {
  extend: (latLng: { lat: number; lng: number }) => void;
};

type GooglePolygonInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  setOptions: (opts: Record<string, unknown>) => void;
};

type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  setPosition: (latLng: { lat: number; lng: number }) => void;
};

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
  }
}

const KITCHEN_MAP_ZOOM = 12;
const MAP_FIT_PADDING = 56;

let mapsLoaderPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();

  if (!mapsLoaderPromise) {
    mapsLoaderPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-homechef-gmaps]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
      script.async = true;
      script.defer = true;
      script.dataset.homechefGmaps = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps failed to load'));
      document.head.appendChild(script);
    });
  }

  return mapsLoaderPromise;
}

export default function DeliveryRegionMapPicker({
  selectedRegionIds,
  onToggleRegion,
  kitchen = null,
}: DeliveryRegionMapPickerProps) {
  const groups = useMemo(() => getDeliveryRegionGroupsNearKitchen(kitchen), [kitchen]);
  const nearbyRegions = useMemo(() => getDeliveryRegionsNearKitchen(kitchen), [kitchen]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const kitchenMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const polygonsRef = useRef<GooglePolygonInstance[]>([]);
  const selectedRegionIdsRef = useRef(selectedRegionIds);
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

  useEffect(() => {
    selectedRegionIdsRef.current = selectedRegionIds;
  }, [selectedRegionIds]);

  const fitMapToSelection = useCallback((map: GoogleMapInstance, regionIds: string[]) => {
    if (!window.google?.maps) return;

    if (regionIds.length === 0) {
      map.panTo({
        lat: DEFAULT_REGION_MAP_VIEW.center.lat,
        lng: DEFAULT_REGION_MAP_VIEW.center.lon,
      });
      map.setZoom(DEFAULT_REGION_MAP_VIEW.zoom);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    regionIds.forEach((regionId) => {
      const region = DELIVERY_REGIONS.find((entry) => entry.id === regionId);
      if (!region) return;
      regionOutlineToLatLngPath(region).forEach((point) => bounds.extend(point));
    });

    map.fitBounds(bounds, MAP_FIT_PADDING);
  }, []);

  const syncMapToSelection = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const regionIds = selectedRegionIdsRef.current;
    const selected = new Set(regionIds);

    polygonsRef.current.forEach((polygon, index) => {
      const region = DELIVERY_REGIONS[index];
      if (!region) return;
      polygon.setMap(selected.has(region.id) ? map : null);
    });

    fitMapToSelection(map, regionIds);
  }, [fitMapToSelection]);

  useEffect(() => {
    if (!apiKey || !mapContainerRef.current) return;

    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapContainerRef.current || !window.google?.maps) return;

        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: DEFAULT_REGION_MAP_VIEW.center.lat, lng: DEFAULT_REGION_MAP_VIEW.center.lon },
          zoom: DEFAULT_REGION_MAP_VIEW.zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });

        mapRef.current = map;
        polygonsRef.current = DELIVERY_REGIONS.map((region) =>
          new window.google!.maps.Polygon({
            paths: regionOutlineToLatLngPath(region),
            strokeColor: '#FE734C',
            fillColor: '#FE734C',
            fillOpacity: 0.22,
            strokeOpacity: 1,
            strokeWeight: 2.5,
            clickable: false,
          }),
        );

        kitchenMarkerRef.current = new window.google.maps.Marker({
          map: null,
          title: 'Your kitchen',
        });

        syncMapToSelection();
      })
      .catch(() => {
        // Fallback UI handled by empty map container message below.
      });

    return () => {
      cancelled = true;
      polygonsRef.current.forEach((polygon) => polygon.setMap(null));
      polygonsRef.current = [];
      kitchenMarkerRef.current?.setMap(null);
      kitchenMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, syncMapToSelection]);

  useEffect(() => {
    syncMapToSelection();
  }, [selectedRegionIds, syncMapToSelection]);

  useEffect(() => {
    const marker = kitchenMarkerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;

    if (!kitchen) {
      marker.setMap(null);
      return;
    }

    marker.setPosition({ lat: kitchen.lat, lng: kitchen.lon });
    marker.setMap(map);
  }, [kitchen]);

  const goToKitchen = useCallback(() => {
    if (!kitchen || !mapRef.current) return;
    mapRef.current.panTo({ lat: kitchen.lat, lng: kitchen.lon });
    mapRef.current.setZoom(KITCHEN_MAP_ZOOM);
  }, [kitchen]);

  const selectionSummary = !kitchen
    ? `Add your kitchen address above to see cities within ${DELIVERY_REGION_PILL_MAX_KM} km.`
    : nearbyRegions.length === 0
      ? `No delivery cities found within ${DELIVERY_REGION_PILL_MAX_KM} km of your address.`
      : selectedRegionIds.length === 0
        ? `Select from ${nearbyRegions.length} nearby ${nearbyRegions.length === 1 ? 'city' : 'cities'} — the map will highlight and zoom to fit.`
        : `${selectedRegionIds.length} region${selectedRegionIds.length === 1 ? '' : 's'} selected on map.`;

  return (
    <View style={styles.wrap}>
      {!apiKey ? (
        <View style={styles.fallbackBox}>
          <Text style={styles.fallbackText}>Map unavailable — configure Google Maps API key.</Text>
        </View>
      ) : (
        <View style={styles.mapShell}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          <View style={styles.mapOverlay} pointerEvents="box-none">
            <TouchableOpacity
              onPress={goToKitchen}
              disabled={!kitchen}
              style={[styles.kitchenButton, !kitchen && styles.kitchenButtonDisabled]}
            >
              <Text style={[styles.kitchenButtonText, !kitchen && styles.kitchenButtonTextDisabled]}>
                Go to my address
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!kitchen ? null : (
        <Text style={styles.kitchenHint}>
          Showing cities within {DELIVERY_REGION_PILL_MAX_KM} km of your kitchen address.
        </Text>
      )}

      <Text style={styles.hint}>{selectionSummary}</Text>

      {kitchen && nearbyRegions.length > 0 ? (
        <ScrollView style={styles.groupScroll} nestedScrollEnabled>
          {groups.map((group) => {
            const regionsInGroup = nearbyRegions.filter((region) => region.group === group);
            if (regionsInGroup.length === 0) return null;

            return (
              <View key={group} style={styles.groupBlock}>
                <Text style={styles.groupTitle}>{group}</Text>
                <View style={styles.chipRow}>
                  {regionsInGroup.map((region) => {
                    const selected = selectedRegionIds.includes(region.id);
                    return (
                      <TouchableOpacity
                        key={region.id}
                        onPress={() => onToggleRegion(region.id)}
                        style={[styles.chip, selected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {region.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  mapShell: {
    width: '100%',
    height: 320,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  mapOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    zIndex: 2,
  },
  kitchenButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  kitchenButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  kitchenButtonText: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold as '700',
  },
  kitchenButtonTextDisabled: {
    color: '#94A3B8',
  },
  kitchenHint: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 20,
  },
  fallbackBox: {
    width: '100%',
    height: 220,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackText: {
    color: '#667085',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  hint: {
    color: '#667085',
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.body,
    lineHeight: 20,
  },
  groupScroll: {
    maxHeight: 220,
  },
  groupBlock: {
    marginBottom: 12,
    gap: 8,
  },
  groupTitle: {
    color: '#101828',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold as '700',
    fontFamily: theme.typography.fontFamily.body,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}18`,
  },
  chipText: {
    color: '#101828',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.body,
  },
  chipTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
