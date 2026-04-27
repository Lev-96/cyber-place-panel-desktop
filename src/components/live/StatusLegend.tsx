import { PlaceLiveStatus, PlaceStatusColors, PlaceStatusLabels } from "@/domain/PlaceStatus";

interface Props {
  totals: Record<PlaceLiveStatus, number> & { total: number };
}

const ORDER: PlaceLiveStatus[] = ["free", "busy", "reserved", "maintenance"];

const StatusLegend = ({ totals }: Props) => (
  <div className="legend">
    {ORDER.map((s) => (
      <div className="item" key={s}>
        <span className="dot" style={{ background: PlaceStatusColors[s] }} />
        <span>{PlaceStatusLabels[s]} <span className="count">{totals[s]}</span></span>
      </div>
    ))}
    <span className="total">Total <span className="count">{totals.total}</span></span>
  </div>
);

export default StatusLegend;
