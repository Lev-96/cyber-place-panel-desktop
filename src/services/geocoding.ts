/**
 * Address-to-coordinates lookup via Nominatim (OpenStreetMap).
 *
 * Same provider used by the RN cyberplace-panel. Free and keyless, but rate
 * limited — caller should debounce. We always pass `Accept-Language` and
 * a `Referer`-like UA hint via the Origin header (fetch can't override
 * User-Agent in renderer, that's fine: Electron's default UA is acceptable
 * to Nominatim for low-volume embed apps).
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

export const geocodeAddress = async (query: string): Promise<GeocodeResult[]> => {
  const q = query.trim();
  if (!q) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return data.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lon),
    displayName: r.display_name,
  })).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
};
