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
}

const BranchMap = ({ markers, center, zoom = 12, height = 360, onPick }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const first = center ?? markers[0] ?? { lat: 40.18, lng: 44.5 }; // default Yerevan
    const map = L.map(ref.current).setView([first.lat, first.lng], zoom);
    // CartoDB Dark Matter — free, no API key, allows embedded apps unlike
    // OSM volunteer tiles which 403 unidentified clients.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: "© OpenStreetMap, © CartoDB",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (onPick) {
      map.on("click", (e: L.LeafletMouseEvent) => onPick(e.latlng.lat, e.latlng.lng));
    }

    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
