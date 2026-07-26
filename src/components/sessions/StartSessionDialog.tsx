import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Checkbox from "@/components/ui/Checkbox";
import PriceInput from "@/components/ui/PriceInput";
import Spinner from "@/components/ui/Spinner";
import { useLang } from "@/i18n/LanguageContext";
import { timePackageNameOf } from "@/i18n/timePackageName";
import { branchRepository } from "@/repositories/BranchRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ITimePackage } from "@/types/sessions";
import { isDeviceStartable, isPs } from "@/types/pc";
import { IBranchApi } from "@/types/api";
import { useEffect, useMemo, useState } from "react";

interface Props {
  branchId: number;
  pc: IPcApi;
  onClose: () => void;
  onStarted: () => void;
}

type Mode = "fixed" | "open";

/**
 * Start-a-session dialog.
 *
 * Two flows:
 *   - "fixed" — pick a TimePackage (name + duration + price). Owner-
 *     defined; the session ends_at fires when the package time is up.
 *   - "open" — count-up billing. NO manual rate input or tariff
 *     picker any more: the rate is the assigned price for the PC's
 *     place (price_for_branches.<platform>-<type> with PC's own
 *     hourly_rate as fallback). Cashier sees what they're about to
 *     charge as a read-only line and clicks Start. Backend mirrors
 *     the same fallback chain so the wire stays consistent even if
 *     this dialog is bypassed.
 *
 * If neither the matrix nor the PC has a rate configured, Start is
 * disabled with a clear message — pricing is an owner/admin task,
 * not something the cashier should be making up at the till.
 */
const StartSessionDialog = ({ branchId, pc, onClose, onStarted }: Props) => {
  const { t, money, lang } = useLang();
  const [packages, setPackages] = useState<ITimePackage[] | null>(null);
  const [pkgId, setPkgId] = useState<number | null>(null);
  // PlayStation rows are billing-only (no kiosk agent), so the open/count-up
  // mode is the only sensible default. PCs default to fixed packages.
  const [mode, setMode] = useState<Mode>(isPs(pc.kind) ? "open" : "fixed");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [branch, setBranch] = useState<IBranchApi | null>(null);
  // Optional per-session price override. Off by default → the session bills
  // at the assigned matrix/PC rate (backend resolution chain). When on, the
  // cashier types a one-off rate, presses Save to confirm it, and only THEN
  // can start — so editing the price never starts the session by itself.
  const [editPrice, setEditPrice] = useState(false);
  const [customRate, setCustomRate] = useState("");
  const [rateSaved, setRateSaved] = useState(false);

  useEffect(() => { void sessionRepository.listPackages(branchId).then((p) => { setPackages(p); setPkgId(p[0]?.id ?? null); }); }, [branchId]);
  useEffect(() => {
    let cancelled = false;
    void branchRepository.byId(branchId).then((b) => {
      if (!cancelled) setBranch(b);
    }).catch(() => {
      if (!cancelled) setBranch(null);
    });
    return () => { cancelled = true; };
  }, [branchId]);

  // Resolve the assigned hourly rate for this PC.
  //   1. price_for_branches.<place.platform>-<place.type> — the matrix
  //      managed on the Branch prices page; same row mobile shows the
  //      player and that auto-sessions bill against.
  //   2. pc.hourly_rate — legacy per-PC override.
  //   3. null — nothing configured; Start is blocked with a message.
  const assignedRate = useMemo<number | null>(() => {
    const place = pc.place;
    const matrix = branch?.price_for_branch;
    if (place && matrix) {
      const key = `${place.platform}-${place.type}` as keyof NonNullable<
        IBranchApi["price_for_branch"]
      >;
      const v = matrix[key];
      if (v != null && Number(v) > 0) return Number(v);
    }
    const ownRate = pc.hourly_rate;
    if (ownRate != null && Number(ownRate) > 0) return Number(ownRate);
    return null;
  }, [pc, branch]);

  // The override only takes effect once it's a valid number AND explicitly
  // saved. Until then the session still bills at the assigned rate, and the
  // start button stays gated on saving — so changing the price never starts
  // the session on its own.
  const customRateNum = Number(customRate);
  const customRateValid = editPrice && Number.isFinite(customRateNum) && customRateNum > 0;
  const overrideApplied = customRateValid && rateSaved;
  const effectiveRate = overrideApplied ? customRateNum : assignedRate;

  // Prefill the override input with the current rate the moment it's enabled,
  // so the operator edits "the current price" rather than a blank field.
  const toggleEditPrice = (next: boolean) => {
    setEditPrice(next);
    setRateSaved(false);
    setCustomRate(next && assignedRate != null ? String(assignedRate) : "");
  };

  // Editing the value invalidates a previous save — the cashier must press
  // Save again before the new number can be used to start.
  const onRateChange = (v: string) => {
    setCustomRate(v);
    setRateSaved(false);
  };

  const saveRate = () => {
    if (customRateValid) setRateSaved(true);
  };

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === "fixed") {
        if (!pkgId) { setErr(t("session.choosePackage")); setBusy(false); return; }
        await sessionRepository.start({
          branch_id: branchId,
          pc_id: pc.id,
          mode: "fixed",
          time_package_id: pkgId,
          user_display_name: pc.label,
        });
      } else {
        if (effectiveRate === null) {
          setErr(t("session.noAssignedRate"));
          setBusy(false);
          return;
        }
        // Only send hourly_rate when the cashier explicitly overrode it via
        // "change current price". Otherwise omit it so the backend resolves
        // the assigned rate from its own chain (request → matrix →
        // pc.hourly_rate) — the single source of truth stays server-side.
        await sessionRepository.start({
          branch_id: branchId,
          pc_id: pc.id,
          mode: "open",
          user_display_name: pc.label,
          ...(overrideApplied ? { hourly_rate: customRateNum } : {}),
        });
      }
      onStarted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to start");
    } finally { setBusy(false); }
  };

  // Defence in depth: the board already hides Start for an unreachable
  // device and the backend rejects it with 422 — but if this dialog is ever
  // opened another way (deep link, stale tile), it must not offer to bill a
  // machine whose agent is not connected.
  const deviceOffline = !isDeviceStartable(pc);

  // Open-mode is unavailable when no rate is configured AND fixed-
  // mode would be the only option; for PS-kind PCs the disabled
  // Start button surfaces the noAssignedRate hint instead.
  const startDisabled =
    busy || deviceOffline || (mode === "open" && (editPrice ? !overrideApplied : assignedRate === null));

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ margin: 0 }}>{t("session.start")} · №{pc.place?.number ?? pc.label}{isPs(pc.kind) ? " (PS)" : ""}</h2>
        {!packages ? <Spinner /> : (
          <>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" onClick={() => setMode("fixed")} style={tabStyle(mode === "fixed")} disabled={isPs(pc.kind)}>
                {t("session.fixedTariff")}
              </button>
              <button type="button" onClick={() => setMode("open")} style={tabStyle(mode === "open")}>
                {t("session.openByHour")}
              </button>
            </div>

            {mode === "fixed" ? (
              <div className="col" style={{ gap: 6 }}>
                <span className="label">{t("session.tariffField")}</span>
                {packages.length === 0 ? (
                  <div className="muted">{t("session.noPackages")}</div>
                ) : (
                  <div className="col" style={{ gap: 6 }}>
                    {packages.map((p) => (
                      <label key={p.id} style={pkgRow(p.id === pkgId)}>
                        <input type="radio" name="pkg" value={p.id} checked={p.id === pkgId} onChange={() => setPkgId(p.id)} />
                        <span style={{ flex: 1 }}>{timePackageNameOf(p, lang)}</span>
                        <span className="muted">{p.duration_minutes} {t("time.minShort") || "min"}</span>
                        <span style={{ fontWeight: 700 }}>{money(Number(p.price))}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="col" style={{ gap: 10 }}>
                <AssignedRateDisplay
                  rate={effectiveRate}
                  hourSuffix={t("time.hourShort") || "h"}
                  noRateText={t("session.noAssignedRate")}
                  rateLabel={t("session.hourlyRate")}
                  money={money}
                />
                <Checkbox checked={editPrice} onChange={toggleEditPrice} label={t("session.editPrice")} />
                {editPrice && (
                  <div className="col" style={{ gap: 6 }}>
                    <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <PriceInput
                          label={t("session.newHourlyRate")}
                          value={customRate}
                          onChange={onRateChange}
                          autoFocus
                        />
                      </div>
                      <Button
                        type="button"
                        variant={rateSaved ? "primary" : "secondary"}
                        onClick={saveRate}
                        disabled={!customRateValid || rateSaved}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {rateSaved ? `✓ ${t("session.priceSaved")}` : t("action.save")}
                      </Button>
                    </div>
                    {!rateSaved && (
                      <span className="muted" style={{ fontSize: 11 }}>{t("session.savePriceHint")}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {deviceOffline && <div className="error">{t("session.deviceOfflineHint")}</div>}
            {err && <div className="error">{err}</div>}
            <div className="row-between">
              <Button variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
              <Button onClick={submit} disabled={startDisabled}>{busy ? "…" : t("action.start")}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

interface AssignedRateDisplayProps {
  rate: number | null;
  hourSuffix: string;
  noRateText: string;
  rateLabel: string;
  money: (n: number) => string;
}

/**
 * Read-only "this is what we'll charge per hour" line for open-mode
 * sessions. No input — the cashier no longer types or picks a rate;
 * the assigned price is the single source of truth.
 */
const AssignedRateDisplay = ({ rate, hourSuffix, noRateText, rateLabel, money }: AssignedRateDisplayProps) => {
  if (rate === null) {
    return (
      <div className="muted" style={{ fontSize: 13, padding: "10px 12px", border: "1px solid #4a3a1a", background: "#2a2210", borderRadius: 8 }}>
        {noRateText}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 12px",
        border: "1px solid #1f2a44",
        background: "#0b1224",
        borderRadius: 8,
      }}
    >
      <span className="muted" style={{ fontSize: 13 }}>{rateLabel}</span>
      <span style={{ fontWeight: 700, fontSize: 16 }}>
        {money(rate)} / {hourSuffix}
      </span>
    </div>
  );
};

const pkgRow = (active: boolean): React.CSSProperties => ({
  display: "flex", gap: 10, alignItems: "center",
  border: `1px solid ${active ? "#07ddf1" : "#1f2a44"}`,
  borderRadius: 8, padding: "10px 12px", cursor: "pointer",
  background: active ? "#101a35" : "transparent",
});

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  // `min-width: 0` lets the flex child actually shrink — without it
  // a long RU/AM label ("Фиксированный тариф", "По часам (открытая)")
  // forces the parent .row past the modal width and the second tab
  // gets clipped. Pairing with `whiteSpace: normal` lets the label
  // wrap to a second line on narrow widths instead of overflowing.
  minWidth: 0,
  padding: "8px 10px",
  border: `1px solid ${active ? "#07ddf1" : "#1f2a44"}`,
  background: active ? "#101a35" : "transparent",
  color: active ? "#07ddf1" : "#9aa8c7",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  whiteSpace: "normal",
  lineHeight: 1.2,
});

export default StartSessionDialog;
