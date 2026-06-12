import type { AvailabilitySlot } from './chef-availability-schedule';
import {
  DELIVERY_REGIONS,
  getDeliveryRegionById,
  getDeliveryRegionName,
  pointInDeliveryRegion,
  regionOutlineArea,
} from './delivery-region-catalog';

export const DELIVERY_ZONE_CONFIG_VERSION = 3;

/** @deprecated Radius-based zones (v2). Kept for parsing legacy data. */
export const DELIVERY_RADIUS_MIN_KM = 2;
export const DELIVERY_RADIUS_MAX_KM = 100;
export const DELIVERY_RADIUS_DEFAULT_KM = 10;
export const LEGACY_DELIVERY_ZONE_RADIUS_KM = 15;

export type DeliveryZone = {
  id: string;
  regionId: string;
  name: string;
  slots: AvailabilitySlot[];
};

export type DeliveryZoneConfig = {
  version: typeof DELIVERY_ZONE_CONFIG_VERSION;
  zones: DeliveryZone[];
};

export type GeoPoint = { lat: number; lon: number };

type LegacyRadiusDeliveryZone = {
  id: string;
  name: string;
  radiusKm: number;
  slots: AvailabilitySlot[];
};

function isLegacySlot(value: unknown): value is AvailabilitySlot {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.day === 'string' && typeof row.timeWindow === 'string';
}

function isCityDeliveryZone(value: unknown): value is DeliveryZone {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string') return false;
  if (typeof row.regionId !== 'string' || row.regionId.length === 0) return false;
  if (!Array.isArray(row.slots) || !row.slots.every(isLegacySlot)) return false;
  return true;
}

function isLegacyRadiusZone(value: unknown): value is LegacyRadiusDeliveryZone {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.name !== 'string') return false;
  const radius = Number(row.radiusKm);
  if (!Number.isFinite(radius) || radius <= 0) return false;
  if (!Array.isArray(row.slots) || !row.slots.every(isLegacySlot)) return false;
  return true;
}

export function createDeliveryZoneId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `zone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeDeliveryZone(zone: Partial<DeliveryZone> & { slots: AvailabilitySlot[] }): DeliveryZone | null {
  const regionId = zone.regionId?.trim();
  if (!regionId) return null;
  const slots = zone.slots.filter((slot) => slot.day && slot.timeWindow);
  if (slots.length === 0) return null;

  const catalogName = getDeliveryRegionName(regionId, zone.name?.trim() || 'Delivery area');

  return {
    id: zone.id ?? createDeliveryZoneId(),
    regionId,
    name: catalogName,
    slots,
  };
}

export function migrateLegacySlotsToZones(slots: AvailabilitySlot[]): DeliveryZone[] {
  if (slots.length === 0) return [];
  return [
    normalizeDeliveryZone({
      id: createDeliveryZoneId(),
      regionId: 'gta',
      name: 'Greater Toronto Area (GTA)',
      slots,
    })!,
  ];
}

function migrateLegacyRadiusZone(zone: LegacyRadiusDeliveryZone): DeliveryZone | null {
  return normalizeDeliveryZone({
    id: zone.id,
    regionId: 'gta',
    name: zone.name.trim() || 'Greater Toronto Area (GTA)',
    slots: zone.slots,
  });
}

/** Parse chefs.delivery_availability JSON (legacy flat array, v2 radius, or v3 city regions). */
export function parseDeliveryAvailability(raw: unknown): DeliveryZoneConfig | null {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    const slots = raw.filter(isLegacySlot);
    if (slots.length === 0) return null;
    return {
      version: DELIVERY_ZONE_CONFIG_VERSION,
      zones: migrateLegacySlotsToZones(slots),
    };
  }

  if (typeof raw === 'string') {
    try {
      return parseDeliveryAvailability(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown>;
    if (Array.isArray(row.zones)) {
      const cityZones = row.zones
        .filter(isCityDeliveryZone)
        .map((zone) => normalizeDeliveryZone(zone))
        .filter((zone): zone is DeliveryZone => zone != null);

      if (cityZones.length > 0) {
        return { version: DELIVERY_ZONE_CONFIG_VERSION, zones: cityZones };
      }

      const radiusZones = row.zones
        .filter(isLegacyRadiusZone)
        .map(migrateLegacyRadiusZone)
        .filter((zone): zone is DeliveryZone => zone != null);

      if (radiusZones.length > 0) {
        return { version: DELIVERY_ZONE_CONFIG_VERSION, zones: radiusZones };
      }
    }
  }

  return null;
}

export function serializeDeliveryAvailability(zones: DeliveryZone[]): DeliveryZoneConfig | null {
  const cleaned = zones
    .map((zone) => normalizeDeliveryZone(zone))
    .filter((zone): zone is DeliveryZone => zone != null);

  if (cleaned.length === 0) return null;

  return {
    version: DELIVERY_ZONE_CONFIG_VERSION,
    zones: cleaned,
  };
}

export function getAllSlotsFromConfig(config: DeliveryZoneConfig | null): AvailabilitySlot[] {
  if (!config) return [];
  return config.zones.flatMap((zone) => zone.slots);
}

/**
 * Match a customer address to the chef's most specific configured city region.
 * When regions overlap (e.g. Toronto inside GTA), the smallest region wins.
 */
export function findMatchingDeliveryZone(
  zones: DeliveryZone[],
  customer: GeoPoint | null,
): DeliveryZone | null {
  if (!customer || zones.length === 0) return null;

  const chefRegionIds = new Set(zones.map((zone) => zone.regionId));
  const matchingRegions = DELIVERY_REGIONS.filter(
    (region) => chefRegionIds.has(region.id) && pointInDeliveryRegion(customer, region),
  ).sort((a, b) => regionOutlineArea(a) - regionOutlineArea(b));

  const bestRegion = matchingRegions[0];
  if (!bestRegion) return null;

  return zones.find((zone) => zone.regionId === bestRegion.id) ?? null;
}

export function stableDeliveryZonesKey(zones: DeliveryZone[]): string {
  return JSON.stringify(
    [...zones]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((zone) => ({
        id: zone.id,
        regionId: zone.regionId,
        name: zone.name,
        slots: [...zone.slots].sort((x, y) =>
          `${x.day}:${x.timeWindow}`.localeCompare(`${y.day}:${y.timeWindow}`),
        ),
      })),
  );
}

export function createDeliveryZoneForRegion(regionId: string): DeliveryZone | null {
  const region = getDeliveryRegionById(regionId);
  if (!region) return null;
  return {
    id: createDeliveryZoneId(),
    regionId: region.id,
    name: region.name,
    slots: [],
  };
}

export { getDeliveryRegionById, getDeliveryRegionName };
