import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ITimePackage } from "@/types/sessions";
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
  const { t, money } = useLang();
  const [packages, setPackages] = useState<ITimePackage[] | null>(null);
  const [pkgId, setPkgId] = useState<number | null>(null);
  // PlayStation rows are billing-only (no kiosk agent), so the open/count-up
  // mode is the only sensible default. PCs default to fixed packages.
  const [mode, setMode] = useState<Mode>(pc.kind === "ps" ? "open" : "fixed");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [branch, setBranch] = useState<IBranchApi | null>(null);

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
        if (assignedRate === null) {
          setErr(t("session.noAssignedRate"));
          setBusy(false);
          return;
        }
        // Don't send hourly_rate — backend resolves the same chain
        // (request → matrix → pc.hourly_rate → 422). Keeping the
        // single-source-of-truth on the server side means a price
        // edit doesn't require us to re-render every cashier
        // dialog to stay correct.
        await sessionRepository.start({
          branch_id: branchId,
          pc_id: pc.id,
          mode: "open",
          user_display_name: pc.label,
        });
      }
      onStarted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to start");
    } finally { setBusy(false); }
  };

  // Open-mode is unavailable when no rate is configured AND fixed-
  // mode would be the only option; for PS-kind PCs the disabled
  // Start button surfaces the noAssignedRate hint instead.
  const startDisabled = busy || (mode === "open" && assignedRate === null);

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 460, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ margin: 0 }}>{t("session.start")} · {pc.label}{pc.kind === "ps" ? " (PS)" : ""}</h2>
        {!packages ? <Spinner /> : (
          <>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" onClick={() => setMode("fixed")} style={tabStyle(mode === "fixed")} disabled={pc.kind === "ps"}>
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
                        <span style={{ flex: 1 }}>{p.name}</span>
                        <span className="muted">{p.duration_minutes} {t("time.minShort") || "min"}</span>
                        <span style={{ fontWeight: 700 }}>{money(Number(p.price))}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <AssignedRateDisplay
                rate={assignedRate}
                hourSuffix={t("time.hourShort") || "h"}
                noRateText={t("session.noAssignedRate")}
                rateLabel={t("session.hourlyRate")}
                money={money}
              />
            )}

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
