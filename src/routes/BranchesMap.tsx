import BranchMap from "@/components/map/BranchMap";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";

/** Laravel returns decimal columns as strings ("40.1800000"). Parse safely. */
const toCoord = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return null; // 0 means "not set" per backend `not_in:0` validator
  return n;
};

const BranchesMap = () => {
  const { t } = useLang();
  const { data, loading, error } = useAsync(() => branchRepository.list(), []);

  const markers = (data ?? [])
    .map((b) => ({
      lat: toCoord(b.address_lat),
      lng: toCoord(b.address_lng),
      label: `<b>${b.company?.name ?? t("hub.branchFallback")}</b><br>${b.address}<br><a href="#/branches/${b.id}">${t("common.open")}</a>`,
    }))
    .filter((m): m is { lat: number; lng: number; label: string } => m.lat !== null && m.lng !== null);

  const total = data?.length ?? 0;
  const geoMsg = t("branchesMap.geoCount").replace("{total}", String(total));

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={t("branchesMap.title")}>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <>
          <span className="muted">{markers.length} {geoMsg}</span>
          <BranchMap markers={markers} height={520} />
          {!markers.length && (
            <div className="card col" style={{ gap: 6 }}>
              <strong>{t("branchesMap.noGeoTitle")}</strong>
              <span className="muted" style={{ fontSize: 13 }}>
                {t("branchesMap.noGeoHint")}
              </span>
            </div>
          )}
        </>
      )}
    </ScreenWithBg>
  );
};

export default BranchesMap;
