import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { pcRepository } from "@/repositories/PcRepository";
import { placeRepository } from "@/repositories/PlaceRepository";
import { fmt } from "@/i18n/translations";
import { IBranchApi, IBranchPlace } from "@/types/api";
import { IPcApi } from "@/types/sessions";
import { PcKind, PC_KIND } from "@/types/pc";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface Props {
  branchId: number;
  initial?: IPcApi;
  onClose: () => void;
  onSaved: (pc: IPcApi) => void;
}

/**
 * Tier key for the branch's hourly-rate matrix (`{platform}-{type}`). A
 * computer is always linked to exactly one place, and that place's
 * platform + type fully determine the tariff — so the operator no longer
 * picks a tier by hand: it's derived from the chosen place and shown for
 * confirmation. Single source of truth for prices stays the branch matrix.
 */
type TierKey =
  | "pc-standard" | "pc-vip"
  | "ps4-standard" | "ps4-vip"
  | "ps5-standard" | "ps5-vip";

interface TierOption {
  key: TierKey;
  /** Localised label, e.g. "PC Standard". */
  label: string;
  /** AMD value from the branch matrix; null when the cell is empty. */
  amount: number | null;
}

const PcForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t, money } = useLang();
  // This form registers COMPUTERS. On create the kind is always PC; on edit
  // we keep whatever the existing device is (never silently convert it), and
  // only use the kind to scope which places may be linked.
  const deviceKind: PcKind = initial?.kind ?? PC_KIND.Pc;

  const [mac, setMac] = useState(initial?.mac_address ?? "");
  const [placeId, setPlaceId] = useState<string>(initial?.place_id ? String(initial.place_id) : "");

  // Branch matrix — drives the derived tariff. Cached for the modal's lifetime.
  const branch = useAsync(() => branchRepository.byId(branchId), [branchId]);
  const matrix = branch.data?.price_for_branch ?? null;

  // Branch places — the linked-place select. A computer may only link to a
  // PC place, so the list is already scoped by kind.
  const places = useAsync(() => placeRepository.listRawByBranch(branchId), [branchId]);
  const placeOptions = useMemo<IBranchPlace[]>(
    () => filterPlacesForKind(places.data ?? [], deviceKind),
    [places.data, deviceKind],
  );

  // If the currently linked place vanished from the scoped list (e.g. it was
  // deleted while the modal was open), drop the stale link so we never submit
  // a place the operator can't see.
  useEffect(() => {
    if (!placeId || places.loading) return;
    if (!placeOptions.some((p) => String(p.id) === placeId)) setPlaceId("");
  }, [placeOptions, placeId, places.loading]);

  const selectedPlace = useMemo<IBranchPlace | null>(
    () => placeOptions.find((p) => String(p.id) === placeId) ?? null,
    [placeOptions, placeId],
  );

  // Tariff is fully determined by the selected place (platform + type). We
  // surface it as a single, read-only tier so the operator sees exactly which
  // rate the computer will bill at — "PC standard place → PC-standard tariff".
  const tier = useMemo<TierOption | null>(
    () => tierForPlace(selectedPlace, matrix),
    [selectedPlace, matrix],
  );
  const selectedAmount = tier?.amount ?? null;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const noPriceForPlace = !!selectedPlace && (tier == null || tier.amount == null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPlace) return setErr(t("pcs.placeRequired"));
    setBusy(true); setErr(null);
    try {
      // Label is no longer typed by hand — derive a stable one from the place
      // so lists that fall back to it (when a place isn't loaded) still read
      // sensibly. The place number is what the cashier actually sees.
      const label = `№${selectedPlace.number ?? selectedPlace.id}`;
      const base = {
        label,
        hourly_rate: selectedAmount,
        mac_address: mac || null,
        place_id: selectedPlace.id,
      };
      const pc = initial
        ? await pcRepository.update(initial.id, base)
        // A fresh registration is always a PC (agent-backed).
        : await pcRepository.create({ branch_id: branchId, kind: PC_KIND.Pc, ...base });
      onSaved(pc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally { setBusy(false); }
  };

  const canSave = !busy && !!selectedPlace && !noPriceForPlace;

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("pcs.editDevice") : t("pcs.newDevice")}</h2>

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("pcs.placeId")}</span>
          {places.loading ? (
            <Spinner />
          ) : placeOptions.length === 0 ? (
            <p className="muted" style={{ margin: 0, color: "#f59e0b" }}>
              {t("pcs.placeEmpty")}
            </p>
          ) : (
            <div style={selectWrap}>
              <select
                className="input"
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                style={selectInner}
                required
              >
                <option value="" disabled>{t("pcs.placeNone")}</option>
                {placeOptions.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {fmt(
                      t("pcs.placeOption"),
                      p.number ?? p.id,
                      p.platform.toUpperCase(),
                      p.type === "vip" ? "VIP" : "Standard",
                    )}
                  </option>
                ))}
              </select>
              <span aria-hidden style={selectCaret}>▾</span>
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("pcs.tierLabel")}</span>
          {!selectedPlace ? (
            <p className="muted" style={{ margin: 0 }}>{t("pcs.tierPickPlace")}</p>
          ) : noPriceForPlace ? (
            <p className="muted" style={{ margin: 0, color: "#f59e0b" }}>{t("pcs.tierNoPrices")}</p>
          ) : (
            <div style={selectWrap}>
              {/* Derived, single-option select — the tariff can't drift from the
                  place's platform/type, but the operator still sees it plainly. */}
              <select className="input" value={tier!.key} style={selectInner} disabled>
                <option value={tier!.key}>
                  {tier!.label} — {money(tier!.amount!)}/{t("time.hourShort")}
                </option>
              </select>
              <span aria-hidden style={selectCaret}>▾</span>
            </div>
          )}
        </div>

        {deviceKind === PC_KIND.Pc && (
          <>
            <Input
              label={t("pcForm.macAddress")}
              placeholder="AA:BB:CC:DD:EE:FF"
              value={mac ?? ""}
              onChange={(e) => setMac(e.target.value)}
            />
            <span className="muted" style={{ fontSize: 11, marginTop: -8 }}>
              {t("pcs.macHint")}
            </span>
          </>
        )}

        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={!canSave}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

/**
 * The single tariff a place bills at: its `{platform}-{type}` cell in the
 * branch matrix. Returns null when no place is chosen yet.
 */
const tierForPlace = (
  place: IBranchPlace | null,
  matrix: IBranchApi["price_for_branch"] | null,
): TierOption | null => {
  if (!place) return null;
  const key = `${place.platform}-${place.type}` as TierKey;
  return {
    key,
    label: `${place.platform.toUpperCase()} ${place.type === "vip" ? "VIP" : "Standard"}`,
    amount: numOrNull(matrix?.[key]),
  };
};

/**
 * Restrict the place dropdown to the platforms that match the device kind:
 * a computer (PC) links only to "pc" places; a console links to ps4/ps5.
 * Sorted by `number` so the list matches the physical floor layout.
 */
const filterPlacesForKind = (
  places: IBranchPlace[],
  kind: PcKind,
): IBranchPlace[] => {
  const allowed: readonly string[] = kind === PC_KIND.Pc ? ["pc"] : ["ps4", "ps5"];
  return places
    .filter((p) => allowed.includes(p.platform))
    .sort((a, b) => (a.number ?? a.id) - (b.number ?? b.id));
};

const numOrNull = (v: number | null | undefined): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Wrapper hosts the custom caret on top of the native select.
const selectWrap: React.CSSProperties = {
  position: "relative",
  width: "100%",
};

// Reuse the project's `.input` class for the base styling and only override
// the bits a select needs: hide the native chrome arrow and leave room on
// the right for our custom caret.
const selectInner: React.CSSProperties = {
  width: "100%",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  paddingRight: 32,
  cursor: "pointer",
};

const selectCaret: React.CSSProperties = {
  position: "absolute",
  right: 12,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: "#07ddf1",
  fontSize: 12,
};

export default PcForm;
