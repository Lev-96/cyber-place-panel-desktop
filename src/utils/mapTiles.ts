/**
 * Where the map gets its picture from.
 *
 * ## Why this file exists
 * The panel drew its basemap from CartoDB's public CDN — free, no key, and
 * documented in the code as exactly that. CARTO has since put those tiles
 * behind registration: the URL still answers 200, but every tile is now a grey
 * square reading "API KEY REQUIRED · carto.com/basemaps/apikey". Nothing in the
 * app broke; the map simply stopped being a map, and only a look at the screen
 * (or at a downloaded tile) says so.
 *
 * A tile provider is therefore not a URL to bury in a component. It is a thing
 * that changes its terms without warning, so it lives here, once, and can be
 * repointed from the environment without a code change.
 *
 * ## The default
 * Esri's Dark Gray Canvas: no key, permitted for embedded use with attribution,
 * and dark — which this panel needs, since the whole UI is `#020514` and a
 * white basemap would glare out of it. Esri splits the labels into a second
 * "reference" layer, so both are drawn; a single-layer provider configured
 * below replaces the pair.
 *
 * ## Overriding it
 * `VITE_MAP_TILE_URL` (+ `VITE_MAP_TILE_ATTRIBUTION`) takes over completely.
 * That is the seam for a paid basemap — CARTO, Stadia, Thunderforest — whose
 * key belongs in the URL template in the environment, never in this file. The
 * key is public either way (it ships in a desktop bundle and travels in every
 * tile request), which is an argument for restricting it by referer at the
 * provider, not for pretending it is a secret.
 */

export interface TileLayerSpec {
  url: string;
  attribution: string;
  /** How far the map may zoom. */
  maxZoom: number;
  /**
   * The deepest zoom the provider actually has tiles for. Beyond it Leaflet
   * upscales the last real tile instead of drawing blanks — which is what the
   * address picker needs: it lets an operator zoom past z16 to drop a pin on
   * the right side of a street, at the cost of a slightly soft basemap.
   */
  maxNativeZoom?: number;
  subdomains?: string;
}

/** Esri Dark Gray Canvas — the picture. */
const ESRI_DARK_BASE: TileLayerSpec = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  attribution: "© Esri, HERE, Garmin, © OpenStreetMap contributors",
  maxZoom: 19,
  maxNativeZoom: 16,
};

/** …and the names on top of it. */
const ESRI_DARK_LABELS: TileLayerSpec = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
  attribution: "",
  maxZoom: 19,
  maxNativeZoom: 16,
};

const configured = (import.meta.env.VITE_MAP_TILE_URL ?? "").trim();

/**
 * The layers to add to a Leaflet map, in draw order.
 *
 * One entry when the environment names a provider, two for the default (base +
 * labels). Callers just iterate — they never need to know which case they got.
 */
export const mapTileLayers = (): TileLayerSpec[] => {
  if (configured) {
    return [{
      url: configured,
      attribution: (import.meta.env.VITE_MAP_TILE_ATTRIBUTION ?? "").trim(),
      maxZoom: Number(import.meta.env.VITE_MAP_TILE_MAX_ZOOM ?? 19),
      maxNativeZoom: import.meta.env.VITE_MAP_TILE_MAX_NATIVE_ZOOM
        ? Number(import.meta.env.VITE_MAP_TILE_MAX_NATIVE_ZOOM)
        : undefined,
      subdomains: (import.meta.env.VITE_MAP_TILE_SUBDOMAINS ?? "").trim() || undefined,
    }];
  }

  return [ESRI_DARK_BASE, ESRI_DARK_LABELS];
};
