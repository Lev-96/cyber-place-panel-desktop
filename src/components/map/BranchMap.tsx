import { mapTileLayers } from "@/utils/mapTiles";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

interface MarkerSpec {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  markers: MarkerSpec[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  onPick?: (lat: number, lng: number) => void;
  /**
   * Draw an AREA instead of a point (2026-10-07, Security → IP activity): a
   * circle of this radius around `center`, framed to fit. Passing the prop at
   * all — even `null`, "radius unknown" — switches the map to area mode, which
   * caps the zoom at {@link AREA_MAX_ZOOM}: an approximate location must never
   * be shown at street level, where it would read as an address.
   */
  accuracyRadiusKm?: number | null;
}

/**
 * The deepest zoom an area-mode map allows: a whole district / small city on
 * a dialog-sized map. A 10 km circle fills the frame around zoom 9-10; a 1 km
 * one would be framed at street level without this cap.
 */
export const AREA_MAX_ZOOM = 11;

/** Pixels kept between the accuracy circle and the map's edge. */
const AREA_FIT_PADDING: L.PointExpression = [16, 16];

const BranchMap = ({ markers, center, zoom = 12, height = 360, onPick, accuracyRadiusKm }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const areaRef = useRef<L.Circle | null>(null);
  const areaMode = accuracyRadiusKm !== undefined;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const first = center ?? markers[0] ?? { lat: 40.18, lng: 44.5 }; // default Yerevan
    const map = L.map(ref.current, areaMode ? { maxZoom: AREA_MAX_ZOOM } : undefined)
      .setView([first.lat, first.lng], areaMode ? Math.min(zoom, AREA_MAX_ZOOM) : zoom);
    // The basemap comes from `utils/mapTiles` rather than a URL written here:
    // CARTO put the tiles this used to draw behind an API key, and every tile
    // silently became a grey square saying so. A provider is something that
    // changes its terms, so it is configurable in one place.
    for (const layer of mapTileLayers()) {
      L.tileLayer(layer.url, {
        maxZoom: layer.maxZoom,
        maxNativeZoom: layer.maxNativeZoom,
        subdomains: layer.subdomains ?? "abc",
        attribution: layer.attribution,
      }).addTo(map);
    }
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (onPick) {
      map.on("click", (e: L.LeafletMouseEvent) => onPick(e.latlng.lat, e.latlng.lng));
    }

    // Leaflet measures its container once, at creation. Inside a dialog that
    // is still settling (or a panel that resizes) that size is stale and the
    // tiles cover only part of the frame: re-measure whenever the container
    // changes size, and once after the first paint. The area is re-framed too.
    const remeasure = () => {
      map.invalidateSize();
      if (areaRef.current) map.fitBounds(areaRef.current.getBounds(), { padding: AREA_FIT_PADDING, maxZoom: AREA_MAX_ZOOM });
    };
    const frame = requestAnimationFrame(remeasure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(remeasure);
    observer?.observe(ref.current);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      areaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The accuracy circle (area mode only). Radius in METRES for Leaflet; no
  // radius → no circle, just the capped view around the centre.
  const areaKey = areaMode && center && accuracyRadiusKm
    ? `${center.lat.toFixed(6)},${center.lng.toFixed(6)},${accuracyRadiusKm}`
    : "";
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    areaRef.current?.remove();
    areaRef.current = null;
    if (!areaKey || !center || !accuracyRadiusKm) return;
    const circle = L.circle([center.lat, center.lng], {
      radius: accuracyRadiusKm * 1000,
      className: "cp-map-area",
      interactive: false,
    }).addTo(map);
    areaRef.current = circle;
    map.fitBounds(circle.getBounds(), { padding: AREA_FIT_PADDING, maxZoom: AREA_MAX_ZOOM });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey]);

  // Sync markers. Keyed on the actual coordinates/labels so the drop-in
  // animation only fires when the pin truly moves — not on every unrelated
  // re-render (markers is rebuilt inline by the parent on each render).
  const markersKey = markers
    .map((m) => `${m.lat.toFixed(6)},${m.lng.toFixed(6)},${m.label ?? ""}`)
    .join("|");
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const m of markers) {
      // Animated location pin: cyan core that drops in with a bounce and
      // emits three expanding radar pulses — styles live in global.css
      // (.cp-map-pin*). divIcon keeps className empty so Leaflet's default
      // white box doesn't render behind it.
      const icon = L.divIcon({
        html: `<div class="cp-map-pin" aria-hidden="true">
            <span class="cp-map-pin__pulse"></span>
            <span class="cp-map-pin__pulse cp-map-pin__pulse--2"></span>
            <span class="cp-map-pin__pulse cp-map-pin__pulse--3"></span>
            <span class="cp-map-pin__core"></span>
          </div>`,
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -12],
      });
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(layer);
      if (m.label) marker.bindPopup(m.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey]);

  return <div ref={ref} style={{ width: "100%", height, borderRadius: 12, overflow: "hidden" }} />;
};

export default BranchMap;
