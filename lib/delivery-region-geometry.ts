import type { GeoPoint } from './delivery-zones';
import regionPolygonsJson from './data/delivery-region-polygons.json';

export type RegionBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

const regionPolygons = regionPolygonsJson as Record<string, GeoPoint[]>;

export function boundsToPolygon(bounds: RegionBounds): GeoPoint[] {
  const { north, south, east, west } = bounds;
  return [
    { lat: north, lon: west },
    { lat: north, lon: east },
    { lat: south, lon: east },
    { lat: south, lon: west },
    { lat: north, lon: west },
  ];
}

export function getRegionPolygon(regionId: string, bounds: RegionBounds): GeoPoint[] {
  const polygon = regionPolygons[regionId];
  if (polygon?.length) return polygon;
  return boundsToPolygon(bounds);
}

export function polygonToPathCoords(polygon: GeoPoint[]): string {
  return polygon.map((point) => `${point.lat},${point.lon}`).join('|');
}

export function polygonToLatLngPath(polygon: GeoPoint[]): Array<{ lat: number; lng: number }> {
  return polygon.map((point) => ({ lat: point.lat, lng: point.lon }));
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;

    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi + 0.0) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function polygonArea(polygon: GeoPoint[]): number {
  if (polygon.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < polygon.length - 1; i++) {
    const a = polygon[i];
    const b = polygon[i + 1];
    area += a.lon * b.lat - b.lon * a.lat;
  }

  return Math.abs(area / 2);
}

export function regionOutlineToPathCoords(regionId: string, bounds: RegionBounds): string {
  return polygonToPathCoords(getRegionPolygon(regionId, bounds));
}

export function regionOutlineToLatLngPath(
  regionId: string,
  bounds: RegionBounds,
): Array<{ lat: number; lng: number }> {
  return polygonToLatLngPath(getRegionPolygon(regionId, bounds));
}

export function pointInRegionOutline(
  point: GeoPoint,
  regionId: string,
  bounds: RegionBounds,
): boolean {
  return pointInPolygon(point, getRegionPolygon(regionId, bounds));
}

export function regionOutlineArea(regionId: string, bounds: RegionBounds): number {
  return polygonArea(getRegionPolygon(regionId, bounds));
}

export function getPolygonBounds(polygon: GeoPoint[]): RegionBounds | null {
  if (polygon.length === 0) return null;

  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const point of polygon) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lon);
    west = Math.min(west, point.lon);
  }

  return { north, south, east, west };
}

export function mergeBounds(boundsList: RegionBounds[]): RegionBounds | null {
  if (boundsList.length === 0) return null;

  return boundsList.reduce<RegionBounds>(
    (acc, bounds) => ({
      north: Math.max(acc.north, bounds.north),
      south: Math.min(acc.south, bounds.south),
      east: Math.max(acc.east, bounds.east),
      west: Math.min(acc.west, bounds.west),
    }),
    boundsList[0],
  );
}

/** Compute center + zoom so all bounds fit in a static map frame. */
export function boundsToMapViewport(
  bounds: RegionBounds,
  mapWidthPx = 640,
  mapHeightPx = 320,
  paddingRatio = 0.14,
): { center: GeoPoint; zoom: number } {
  const latSpan = Math.max(bounds.north - bounds.south, 0.02);
  const lonSpan = Math.max(bounds.east - bounds.west, 0.02);
  const latPad = latSpan * paddingRatio;
  const lonPad = lonSpan * paddingRatio;

  const north = bounds.north + latPad;
  const south = bounds.south - latPad;
  const east = bounds.east + lonPad;
  const west = bounds.west - lonPad;

  const center = {
    lat: (north + south) / 2,
    lon: (east + west) / 2,
  };

  const latFraction = latSpan / 180;
  const lngFraction = lonSpan / 360;
  const worldPxWidth = 256;

  const zoomLat = Math.log2(mapHeightPx / worldPxWidth / latFraction);
  const zoomLng = Math.log2(mapWidthPx / worldPxWidth / lngFraction);
  const zoom = Math.min(14, Math.max(5, Math.floor(Math.min(zoomLat, zoomLng))));

  return { center, zoom };
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Shortest distance from a kitchen to a region outline (0 if inside the region). */
export function distanceKmToRegion(
  kitchen: GeoPoint,
  regionId: string,
  bounds: RegionBounds,
  mapCenter: GeoPoint,
): number {
  const polygon = getRegionPolygon(regionId, bounds);
  if (pointInPolygon(kitchen, polygon)) return 0;

  let minDistance = haversineDistanceKm(kitchen, mapCenter);
  for (const point of polygon) {
    minDistance = Math.min(minDistance, haversineDistanceKm(kitchen, point));
  }

  return minDistance;
}
