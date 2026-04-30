import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { useLang } from "@/i18n/LanguageContext";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ITimePackage } from "@/types/sessions";
import { useEffect, useState } from "react";

interface Props {
  branchId: number;
  pc: IPcApi;
  onClose: () => void;
  onStarted: () => void;
}

type Mode = "fixed" | "open";

const StartSessionDialog = ({ branchId, pc, onClose, onStarted }: Props) => {
  const { t, money } = useLang();
  const [packages, setPackages] = useState<ITimePackage[] | null>(null);
  const [pkgId, setPkgId] = useState<number | null>(null);
  // PlayStation rows are billing-only (no kiosk agent), so the open/count-up
  // mode is the only sensible default. PCs default to fixed packages.
  const [mode, setMode] = useState<Mode>(pc.kind === "ps" ? "open" : "fixed");
  const [rate, setRate] = useState<string>(() => {
    const r = pc.hourly_rate;
    return r != null ? String(r) : "";
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void sessionRepository.listPackages(branchId).then((p) => { setPackages(p); setPkgId(p[0]?.id ?? null); }); }, [branchId]);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === "fixed") {
        if (!pkgId) { setErr(t("session.choosePackage")); setBusy(false); return; }
        await sessionRepository.start({ branch_id: branchId, pc_id: pc.id, mode: "fixed", time_package_id: pkgId, user_display_name: pc.label });
      } else {
        const r = parseFloat(rate.replace(",", "."));
        if (!Number.isFinite(r) || r <= 0) { setErr(t("session.enterRate")); setBusy(false); return; }
        await sessionRepository.start({ branch_id: branchId, pc_id: pc.id, mode: "open", hourly_rate: r, user_display_name: pc.label });
      }
      onStarted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to start");
    } finally { setBusy(false); }
  };

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
              <div className="col" style={{ gap: 6 }}>
                <Input
                  label={t("session.hourlyRate")}
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="1000"
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  {t("session.openHint")}
                </span>
              </div>
            )}

            {err && <div className="error">{err}</div>}
            <div className="row-between">
              <Button variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
              <Button onClick={submit} disabled={busy}>{busy ? "…" : t("action.start")}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
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
  padding: "8px 10px",
  border: `1px solid ${active ? "#07ddf1" : "#1f2a44"}`,
  background: active ? "#101a35" : "transparent",
  color: active ? "#07ddf1" : "#9aa8c7",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
});

export default StartSessionDialog;
