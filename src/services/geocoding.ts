/**
 * Address-to-coordinates lookup via Nominatim (OpenStreetMap).
 *
 * Same provider used by the RN cyberplace-panel. Free and keyless, but rate
 * limited — caller should debounce. We always pass `Accept-Language` and
 * a `Referer`-like UA hint via the Origin header (fetch can't override
 * User-Agent in renderer, that's fine: Electron's default UA is acceptable
 * to Nominatim for low-volume embed apps).
 *
 * `addressdetails=1` returns the structured `address` object so we can offer
 * a clean SHORT label (street + house number) for the form field instead of
 * the full multi-part `display_name`, plus a verified city / country that the
 * form can trust (the player only ever sees a real, geocoder-confirmed place).
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Full formatted address — shown in the suggestion dropdown. */
  displayName: string;
  /** Short human label for the saved address, e.g. "Samvel Safaryan 14". */
  shortAddress: string;
  /** Verified city / town / village name (empty if the result has none). */
  city: string;
  /** Verified English country name (empty if unknown). */
  country: string;
  /** ISO 3166-1 alpha-2 country code, uppercase (empty if unknown). */
  countryCode: string;
}

/** Subset of Nominatim's `address` object we read. */
interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  residential?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  country?: string;
  country_code?: string;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

/** Build a short, readable address: street + house number when available. */
const buildShortAddress = (a: NominatimAddress | undefined, fallback: string): string => {
  const firstSegment = () => fallback.split(",")[0]?.trim() || fallback;
  if (!a) return firstSegment();
  const street =
    a.road || a.pedestrian || a.footway || a.residential ||
    a.neighbourhood || a.suburb || a.quarter;
  const parts = [street, a.house_number].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ");
  const locality = a.city || a.town || a.village || a.suburb || a.neighbourhood;
  return locality || firstSegment();
};

const cityOf = (a: NominatimAddress | undefined): string =>
  (a?.city || a?.town || a?.village || a?.municipality || a?.suburb || "").trim();

export const geocodeAddress = async (query: string): Promise<GeocodeResult[]> => {
  const q = query.trim();
  if (!q) return [];
  const url =
    `${ENDPOINT}?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: NominatimAddress;
  }>;
  return data
    .map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lon),
      displayName: r.display_name,
      shortAddress: buildShortAddress(r.address, r.display_name),
      city: cityOf(r.address),
      country: (r.address?.country ?? "").trim(),
      countryCode: (r.address?.country_code ?? "").trim().toUpperCase(),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
};
