import { useLang } from "@/i18n/LanguageContext";
import { PlaceLiveStatus, PlaceStatusColors } from "@/domain/PlaceStatus";

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
          <span className="dot" style={{ background: PlaceStatusColors[s] }} />
          <span>{t(`place.${s}`)} <span className="count">{totals[s]}</span></span>
        </div>
      ))}
      <span className="total">{t("live.total")} <span className="count">{totals.total}</span></span>
    </div>
  );
};

export default StatusLegend;
