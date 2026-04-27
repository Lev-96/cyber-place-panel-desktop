import { PlaceStatusColors, PlaceStatusLabels } from "@/domain/PlaceStatus";
import { PlaceSnapshot } from "@/services/realtime/RealtimeService";

const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const PlaceCell = ({ snapshot }: { snapshot: PlaceSnapshot }) => {
  const { place, status, bookings } = snapshot;
  const color = PlaceStatusColors[status];
  const top = bookings[0];
  return (
    <div className="place-cell" style={{ borderColor: color }}>
      <span className="dot" style={{ background: color }} />
      <span className="platform">{place.platform.toUpperCase()} · {place.type}</span>
      <span className="id">#{place.id}</span>
      <span className="status" style={{ color }}>{PlaceStatusLabels[status]}</span>
      {top && (
        <span className="until">
          {status === "busy" ? "till " : "from "}
          {fmt(status === "busy" ? top.end : top.start)}
        </span>
      )}
    </div>
  );
};

export default PlaceCell;
