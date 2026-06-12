import type { GeoPoint } from './delivery-zones';
import {
  boundsToMapViewport,
  distanceKmToRegion,
  getPolygonBounds,
  getRegionPolygon as geometryGetRegionPolygon,
  mergeBounds,
  pointInRegionOutline,
  regionOutlineArea as geometryRegionOutlineArea,
  regionOutlineToLatLngPath as geometryRegionOutlineToLatLngPath,
  regionOutlineToPathCoords as geometryRegionOutlineToPathCoords,
  type RegionBounds,
} from './delivery-region-geometry';

export type { RegionBounds };

export type DeliveryRegionDefinition = {
  id: string;
  name: string;
  group: string;
  bounds: RegionBounds;
  mapCenter: GeoPoint;
  mapZoom: number;
};

/** Predefined city / metro delivery regions chefs can select on the map. */
export const DELIVERY_REGIONS: DeliveryRegionDefinition[] = [
  {
    id: 'gta',
    name: 'Greater Toronto Area (GTA)',
    group: 'GTA',
    bounds: { north: 44.05, south: 43.35, west: -80.15, east: -78.75 },
    mapCenter: { lat: 43.72, lon: -79.45 },
    mapZoom: 9,
  },
  {
    id: 'toronto',
    name: 'Toronto',
    group: 'GTA',
    bounds: { north: 43.855, south: 43.581, west: -79.639, east: -79.116 },
    mapCenter: { lat: 43.653, lon: -79.383 },
    mapZoom: 11,
  },
  {
    id: 'mississauga',
    name: 'Mississauga',
    group: 'GTA',
    bounds: { north: 43.68, south: 43.51, west: -79.82, east: -79.58 },
    mapCenter: { lat: 43.589, lon: -79.644 },
    mapZoom: 11,
  },
  {
    id: 'brampton',
    name: 'Brampton',
    group: 'GTA',
    bounds: { north: 43.88, south: 43.65, west: -79.9, east: -79.65 },
    mapCenter: { lat: 43.731, lon: -79.762 },
    mapZoom: 11,
  },
  {
    id: 'markham',
    name: 'Markham',
    group: 'GTA',
    bounds: { north: 43.95, south: 43.80, west: -79.4, east: -79.2 },
    mapCenter: { lat: 43.856, lon: -79.337 },
    mapZoom: 11,
  },
  {
    id: 'vaughan',
    name: 'Vaughan',
    group: 'GTA',
    bounds: { north: 43.92, south: 43.78, west: -79.62, east: -79.42 },
    mapCenter: { lat: 43.836, lon: -79.508 },
    mapZoom: 11,
  },
  {
    id: 'richmond-hill',
    name: 'Richmond Hill',
    group: 'GTA',
    bounds: { north: 43.95, south: 43.82, west: -79.5, east: -79.35 },
    mapCenter: { lat: 43.882, lon: -79.438 },
    mapZoom: 11,
  },
  {
    id: 'oakville',
    name: 'Oakville',
    group: 'GTA',
    bounds: { north: 43.52, south: 43.38, west: -79.78, east: -79.62 },
    mapCenter: { lat: 43.467, lon: -79.687 },
    mapZoom: 11,
  },
  {
    id: 'burlington',
    name: 'Burlington',
    group: 'GTA',
    bounds: { north: 43.4, south: 43.28, west: -79.9, east: -79.72 },
    mapCenter: { lat: 43.325, lon: -79.799 },
    mapZoom: 11,
  },
  {
    id: 'hamilton',
    name: 'Hamilton',
    group: 'GTA',
    bounds: { north: 43.28, south: 43.13, west: -80.05, east: -79.75 },
    mapCenter: { lat: 43.255, lon: -79.871 },
    mapZoom: 11,
  },
  {
    id: 'pickering',
    name: 'Pickering',
    group: 'GTA',
    bounds: { north: 43.92, south: 43.78, west: -79.18, east: -79.0 },
    mapCenter: { lat: 43.838, lon: -79.086 },
    mapZoom: 11,
  },
  {
    id: 'ajax',
    name: 'Ajax',
    group: 'GTA',
    bounds: { north: 43.9, south: 43.82, west: -79.08, east: -78.98 },
    mapCenter: { lat: 43.85, lon: -79.032 },
    mapZoom: 11,
  },
  {
    id: 'whitby',
    name: 'Whitby',
    group: 'GTA',
    bounds: { north: 43.95, south: 43.82, west: -79.02, east: -78.88 },
    mapCenter: { lat: 43.898, lon: -78.942 },
    mapZoom: 11,
  },
  {
    id: 'oshawa',
    name: 'Oshawa',
    group: 'GTA',
    bounds: { north: 43.98, south: 43.85, west: -78.95, east: -78.78 },
    mapCenter: { lat: 43.897, lon: -78.866 },
    mapZoom: 11,
  },
  {
    id: 'newmarket',
    name: 'Newmarket',
    group: 'GTA',
    bounds: { north: 44.08, south: 43.98, west: -79.52, east: -79.38 },
    mapCenter: { lat: 44.059, lon: -79.461 },
    mapZoom: 11,
  },
  {
    id: 'ottawa',
    name: 'Ottawa',
    group: 'Ontario',
    bounds: { north: 45.55, south: 45.22, west: -76.05, east: -75.42 },
    mapCenter: { lat: 45.421, lon: -75.697 },
    mapZoom: 10,
  },
  {
    id: 'kitchener-waterloo',
    name: 'Kitchener–Waterloo',
    group: 'Ontario',
    bounds: { north: 43.52, south: 43.38, west: -80.62, east: -80.38 },
    mapCenter: { lat: 43.451, lon: -80.492 },
    mapZoom: 11,
  },
  {
    id: 'london',
    name: 'London',
    group: 'Ontario',
    bounds: { north: 43.05, south: 42.88, west: -81.38, east: -81.12 },
    mapCenter: { lat: 42.984, lon: -81.245 },
    mapZoom: 11,
  },
  {
    id: 'winnipeg',
    name: 'Winnipeg',
    group: 'Manitoba',
    bounds: { north: 49.99, south: 49.75, west: -97.35, east: -96.95 },
    mapCenter: { lat: 49.895, lon: -97.138 },
    mapZoom: 10,
  },
  {
    id: 'vancouver',
    name: 'Vancouver',
    group: 'British Columbia',
    bounds: { north: 49.32, south: 49.2, west: -123.25, east: -123.0 },
    mapCenter: { lat: 49.283, lon: -123.121 },
    mapZoom: 11,
  },
  {
    id: 'calgary',
    name: 'Calgary',
    group: 'Alberta',
    bounds: { north: 51.18, south: 50.84, west: -114.22, east: -113.88 },
    mapCenter: { lat: 51.044, lon: -114.072 },
    mapZoom: 10,
  },
  {
    id: 'edmonton',
    name: 'Edmonton',
    group: 'Alberta',
    bounds: { north: 53.65, south: 53.42, west: -113.68, east: -113.35 },
    mapCenter: { lat: 53.546, lon: -113.494 },
    mapZoom: 10,
  },
  {
    id: 'montreal',
    name: 'Montreal',
    group: 'Quebec',
    bounds: { north: 45.65, south: 45.42, west: -73.72, east: -73.48 },
    mapCenter: { lat: 45.501, lon: -73.567 },
    mapZoom: 10,
  },
];

const regionById = new Map(DELIVERY_REGIONS.map((region) => [region.id, region]));

export function getDeliveryRegionById(regionId: string): DeliveryRegionDefinition | undefined {
  return regionById.get(regionId);
}

export function getDeliveryRegionName(regionId: string, fallback = 'Delivery area'): string {
  return getDeliveryRegionById(regionId)?.name ?? fallback;
}

export function getDeliveryRegionGroups(): string[] {
  return [...new Set(DELIVERY_REGIONS.map((region) => region.group))];
}

export function getDeliveryRegionsByGroup(group: string): DeliveryRegionDefinition[] {
  return DELIVERY_REGIONS.filter((region) => region.group === group);
}

/** Only show delivery region pills within this distance of the chef's kitchen. */
export const DELIVERY_REGION_PILL_MAX_KM = 100;

export function getDeliveryRegionsNearKitchen(
  kitchen: GeoPoint | null,
  maxDistanceKm = DELIVERY_REGION_PILL_MAX_KM,
): DeliveryRegionDefinition[] {
  if (!kitchen) return [];

  return DELIVERY_REGIONS.filter((region) => {
    const distance = distanceKmToRegion(kitchen, region.id, region.bounds, region.mapCenter);
    return distance <= maxDistanceKm;
  }).sort((a, b) => {
    const distA = distanceKmToRegion(kitchen, a.id, a.bounds, a.mapCenter);
    const distB = distanceKmToRegion(kitchen, b.id, b.bounds, b.mapCenter);
    return distA - distB || a.name.localeCompare(b.name);
  });
}

export function getDeliveryRegionGroupsNearKitchen(
  kitchen: GeoPoint | null,
  maxDistanceKm = DELIVERY_REGION_PILL_MAX_KM,
): string[] {
  return [...new Set(getDeliveryRegionsNearKitchen(kitchen, maxDistanceKm).map((region) => region.group))];
}

export function regionBoundsArea(bounds: RegionBounds): number {
  return Math.abs(bounds.north - bounds.south) * Math.abs(bounds.east - bounds.west);
}

export function pointInDeliveryRegion(point: GeoPoint, region: DeliveryRegionDefinition): boolean {
  return pointInRegionOutline(point, region.id, region.bounds);
}

export function regionOutlineToPathCoords(region: DeliveryRegionDefinition): string {
  return geometryRegionOutlineToPathCoords(region.id, region.bounds);
}

export function regionOutlineToLatLngPath(region: DeliveryRegionDefinition): Array<{ lat: number; lng: number }> {
  return geometryRegionOutlineToLatLngPath(region.id, region.bounds);
}

export function regionOutlineArea(region: DeliveryRegionDefinition): number {
  return geometryRegionOutlineArea(region.id, region.bounds);
}

export function getRegionPolygon(region: DeliveryRegionDefinition): GeoPoint[] {
  return geometryGetRegionPolygon(region.id, region.bounds);
}

/** Default map viewport for the region picker (GTA-centric). */
export const DEFAULT_REGION_MAP_VIEW = {
  center: { lat: 43.72, lon: -79.45 },
  zoom: 9,
};

export type RegionMapViewport = {
  center: GeoPoint;
  zoom: number;
};

/** Fit map to the currently selected delivery regions (zooms out as more are added). */
export function getViewportForSelectedRegions(
  selectedRegionIds: string[],
  mapWidthPx = 640,
  mapHeightPx = 320,
): RegionMapViewport {
  if (selectedRegionIds.length === 0) {
    return DEFAULT_REGION_MAP_VIEW;
  }

  const boundsList = selectedRegionIds
    .map((regionId) => {
      const region = getDeliveryRegionById(regionId);
      if (!region) return null;
      const polygon = geometryGetRegionPolygon(region.id, region.bounds);
      return getPolygonBounds(polygon);
    })
    .filter((bounds): bounds is RegionBounds => bounds != null);

  const merged = mergeBounds(boundsList);
  if (!merged) {
    return DEFAULT_REGION_MAP_VIEW;
  }

  return boundsToMapViewport(merged, mapWidthPx, mapHeightPx);
}

export function buildRegionSelectionMapUrl(
  selectedRegionIds: string[],
  apiKey: string,
  size = '640x320',
  options?: {
    viewport?: RegionMapViewport;
    kitchen?: GeoPoint | null;
    autoFitSelection?: boolean;
  },
): string | null {
  if (!apiKey) return null;

  const selected = new Set(selectedRegionIds);
  const regionsToDraw = DELIVERY_REGIONS.filter((region) => selected.has(region.id));

  const pathParams = regionsToDraw.map((region) => {
    const pathValue = `color:0xFE734CFF|fillcolor:0xFE734C33|weight:2.5|${regionOutlineToPathCoords(region)}`;
    return `path=${encodeURIComponent(pathValue)}`;
  }).join('&');

  const [mapWidthPx, mapHeightPx] = size.split('x').map((part) => Number(part));
  const viewport =
    options?.viewport ??
    (options?.autoFitSelection !== false
      ? getViewportForSelectedRegions(
          selectedRegionIds,
          mapWidthPx || 640,
          mapHeightPx || 320,
        )
      : DEFAULT_REGION_MAP_VIEW);

  const markerParam = options?.kitchen
    ? `&markers=${encodeURIComponent(`color:0xFE734C|${options.kitchen.lat},${options.kitchen.lon}`)}`
    : '';

  const pathSegment = pathParams ? `${pathParams}&` : '';

  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${viewport.center.lat},${viewport.center.lon}` +
    `&zoom=${viewport.zoom}&size=${size}&scale=2&maptype=roadmap&${pathSegment}` +
    `${markerParam}&key=${encodeURIComponent(apiKey)}`
  );
}
