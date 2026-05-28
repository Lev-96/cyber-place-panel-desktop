import PlaceForm from "@/components/places/PlaceForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useReservedPlaceIds } from "@/hooks/useReservedPlaceIds";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { placeRepository } from "@/repositories/PlaceRepository";
import { IBranchPlace } from "@/types/api";
import { useState } from "react";
import { useParams } from "react-router-dom";

// Tile border / dot palette. Reserved wins over the place's
// own active/inactive status — a manager looking at this grid
// needs to see "this seat is currently held by a booking" even
// if its admin status is `active`, otherwise they may toggle
// it off thinking it's just a free `active` seat.
const COLOR_RESERVED = "#f59e0b";
const COLOR_ACTIVE = "#22c55e";
const COLOR_IDLE = "#6b7280";

const BranchPlaces = () => {
  const { branchId } = useParams();
  const { t } = useLang();
  const id = Number(branchId);
  const { data, loading, error, reload } = useAsync(() => placeRepository.listRawByBranch(id), [id]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IBranchPlace | null>(null);
  // Same shared hook the Sessions board uses — keeps the two
  // screens in lockstep on which seats are held by an open
  // booking, with one snapshot-on-mount + Reverb-delta path.
  const reservedPlaceIds = useReservedPlaceIds(id);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const remove = async (p: IBranchPlace) => {
    if (!confirm(fmt(t("branchPlaces.confirmDelete"), p.number ?? p.id))) return;
    await placeRepository.remove(p.id);
    void reload();
  };

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={`${t("branchPlaces.title")} · №${id}`}>
      <div className="row-between">
        <span className="muted">{t("branchPlaces.intro")}</span>
        <Button onClick={() => setCreating(true)}>{t("branchPlaces.new")}</Button>
      </div>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="live-grid">
          {(data ?? []).map((p) => {
            const isReserved = reservedPlaceIds.has(p.id);
            const isActive = p.status === "active";
            const tone = isReserved ? COLOR_RESERVED : isActive ? COLOR_ACTIVE : COLOR_IDLE;
            const statusLabel = isReserved
              ? t("session.reserved") || "Reserved"
              : t(`branchPlaces.status.${p.status}`) || p.status;
            return (
              <div key={p.id} className="place-cell" style={{ borderColor: tone, minHeight: 130 }}>
                <span className="dot" style={{ background: tone }} />
                <span className="platform">{p.platform.toUpperCase()} · {p.type}</span>
                <span className="id">№{p.number ?? p.id}</span>
                <span className="status" style={{ color: tone }}>{statusLabel}</span>
                <span className="until">{p.games?.length ?? 0} {t("branchPlaces.games")}</span>
                <div className="row" style={{ gap: 4, marginTop: 6 }}>
                  <Button variant="secondary" onClick={() => setEditing(p)} style={{ padding: "4px 8px", fontSize: 11, flex: 1 }}>{t("action.edit")}</Button>
                  <Button variant="secondary" onClick={() => remove(p)} style={{ padding: "4px 8px", fontSize: 11, color: "#ef4444", borderColor: "#4a1a1a" }}>×</Button>
                </div>
              </div>
            );
          })}
          {!data?.length && <div className="muted">{t("branchPlaces.empty")}</div>}
        </div>
      )}

      {creating && <PlaceForm branchId={id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {editing && <PlaceForm branchId={id} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </ScreenWithBg>
  );
};

export default BranchPlaces;
