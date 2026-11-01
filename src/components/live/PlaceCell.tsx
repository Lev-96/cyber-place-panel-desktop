import { useLang } from "@/i18n/LanguageContext";
import { PLACE_STATUS_TONE, PlaceStatusColors } from "@/domain/PlaceStatus";
import StatusChip from "@/components/ui/StatusChip";
import { PlaceSnapshot } from "@/services/realtime/RealtimeService";
import { formatTime } from "@/i18n/dates";
import { platformLabel } from "@/utils/platform";

interface Props {
  snapshot: PlaceSnapshot;
  /** The platform's display name (the branch's own for a custom one); defaults to its label. */
  platformName?: (slug: string) => string;
}

const PlaceCell = ({ snapshot, platformName = platformLabel }: Props) => {
  const { t } = useLang();
  const { place, status, bookings } = snapshot;
  const color = PlaceStatusColors[status];
  const top = bookings[0];
  return (
    <div className="place-cell" style={{ borderColor: color }}>

      <span className="platform">{platformName(place.platform)} · {place.type}</span>
      <span className="id">№{place.number ?? place.id}</span>
      {/* Colour, icon and word together (2026-10-27). */}
      <span className="status"><StatusChip tone={PLACE_STATUS_TONE[status]} label={t(`place.${status}`)} /></span>
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
