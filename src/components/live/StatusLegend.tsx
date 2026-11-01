import { useLang } from "@/i18n/LanguageContext";
import { PLACE_STATUS_TONE, PlaceLiveStatus } from "@/domain/PlaceStatus";
import { StatusIcon } from "@/components/ui/StatusChip";
import { toneLook } from "@/domain/statusTone";

interface Props {
  totals: Record<PlaceLiveStatus, number> & { total: number };
}

const ORDER: PlaceLiveStatus[] = ["free", "busy", "reserved", "maintenance"];

const StatusLegend = ({ totals }: Props) => {
  const { t } = useLang();
  return (
    <div className="legend">
      {ORDER.map((s) => (
        <div className="item" key={s}>
          {/* The same icon the seats wear, in their colour (2026-10-27). */}
          <span className="legend__icon" style={{ color: toneLook(PLACE_STATUS_TONE[s]).fg }}><StatusIcon tone={PLACE_STATUS_TONE[s]} /></span>
          <span>{t(`place.${s}`)} <span className="count">{totals[s]}</span></span>
        </div>
      ))}
      <span className="total">{t("live.total")} <span className="count">{totals.total}</span></span>
    </div>
  );
};

export default StatusLegend;
