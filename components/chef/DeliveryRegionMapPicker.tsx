import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';
import type { GeoPoint } from '../../lib/delivery-zones';
import {
  buildRegionSelectionMapUrl,
  DELIVERY_REGION_PILL_MAX_KM,
  getDeliveryRegionGroupsNearKitchen,
  getDeliveryRegionsNearKitchen,
  getViewportForSelectedRegions,
  type RegionMapViewport,
} from '../../lib/delivery-region-catalog';

type DeliveryRegionMapPickerProps = {
  selectedRegionIds: string[];
  onToggleRegion: (regionId: string) => void;
  kitchen?: GeoPoint | null;
};

const KITCHEN_MAP_ZOOM = 11;

export default function DeliveryRegionMapPicker({
  selectedRegionIds,
  onToggleRegion,
  kitchen = null,
}: DeliveryRegionMapPickerProps) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
  const groups = useMemo(() => getDeliveryRegionGroupsNearKitchen(kitchen), [kitchen]);
  const nearbyRegions = useMemo(() => getDeliveryRegionsNearKitchen(kitchen), [kitchen]);
  const [kitchenViewport, setKitchenViewport] = useState<RegionMapViewport | null>(null);

  const autoViewport = useMemo(
    () => getViewportForSelectedRegions(selectedRegionIds, 640, 320),
    [selectedRegionIds],
  );

  const mapUrl = useMemo(
    () =>
      buildRegionSelectionMapUrl(selectedRegionIds, apiKey, '640x320', {
        viewport: kitchenViewport ?? autoViewport,
        kitchen,
        autoFitSelection: false,
      }),
    [selectedRegionIds, apiKey, kitchenViewport, autoViewport, kitchen],
  );

  const goToKitchen = () => {
    if (!kitchen) return;
    setKitchenViewport({ center: kitchen, zoom: KITCHEN_MAP_ZOOM });
  };

  const handleToggleRegion = (regionId: string) => {
    setKitchenViewport(null);
    onToggleRegion(regionId);
  };

  const selectionSummary = !kitchen
    ? `Add your kitchen address above to see cities within ${DELIVERY_REGION_PILL_MAX_KM} km.`
    : nearbyRegions.length === 0
      ? `No delivery cities found within ${DELIVERY_REGION_PILL_MAX_KM} km of your address.`
      : selectedRegionIds.length === 0
        ? `Select from ${nearbyRegions.length} nearby ${nearbyRegions.length === 1 ? 'city' : 'cities'} — the map will highlight and zoom to fit.`
        : `${selectedRegionIds.length} region${selectedRegionIds.length === 1 ? '' : 's'} shown on map.`;

  return (
    <View style={styles.wrap}>
      <View style={styles.mapToolbar}>
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

      {kitchen ? (
        <Text style={styles.kitchenHint}>
          Showing cities within {DELIVERY_REGION_PILL_MAX_KM} km of your kitchen address.
        </Text>
      ) : null}

      {mapUrl ? (
        <Image
          source={{ uri: mapUrl }}
          style={styles.mapImage}
          resizeMode="cover"
          accessibilityLabel="Delivery region map"
        />
      ) : (
        <View style={styles.mapFallback}>
          <Text style={styles.mapFallbackText}>Map preview unavailable</Text>
        </View>
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
                        onPress={() => handleToggleRegion(region.id)}
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
    gap: 10,
  },
  mapToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  kitchenButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  mapImage: {
    width: '100%',
    height: 220,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#E5E7EB',
  },
  mapFallback: {
    width: '100%',
    height: 220,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallbackText: {
    color: '#667085',
    fontFamily: theme.typography.fontFamily.body,
    fontSize: theme.typography.fontSize.sm,
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
