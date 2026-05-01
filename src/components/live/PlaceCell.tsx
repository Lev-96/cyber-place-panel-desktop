import { useLang } from "@/i18n/LanguageContext";
import { PlaceStatusColors } from "@/domain/PlaceStatus";
import { PlaceSnapshot } from "@/services/realtime/RealtimeService";
import { formatTime } from "@/i18n/dates";

const PlaceCell = ({ snapshot }: { snapshot: PlaceSnapshot }) => {
  const { t } = useLang();
  const { place, status, bookings } = snapshot;
  const color = PlaceStatusColors[status];
  const top = bookings[0];
  return (
    <div className="place-cell" style={{ borderColor: color }}>
      <span className="dot" style={{ background: color }} />
      <span className="platform">{place.platform.toUpperCase()} · {place.type}</span>
      <span className="id">#{place.id}</span>
      <span className="status" style={{ color }}>{t(`place.${status}`)}</span>
      {top && (
        <span className="until">
          {status === "busy" ? t("live.till") : t("live.from")}{" "}
          {formatTime(status === "busy" ? top.end : top.start)}
        </span>
      )}
    </div>
  );
};

export default PlaceCell;
