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

  // Sync markers
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const m of markers) {
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#07ddf1;border:2px solid #fff;box-shadow:0 0 8px rgba(7,221,241,0.7)"></div>`,
        className: "",
        iconSize: [14, 14],
      });
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(layer);
      if (m.label) marker.bindPopup(m.label);
    }
  }, [markers]);

  return <div ref={ref} style={{ width: "100%", height, borderRadius: 12, overflow: "hidden" }} />;
};

export default BranchMap;
