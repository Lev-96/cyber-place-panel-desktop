import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
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
  // Branch's price matrix — drives the open-mode tariff picker so the
  // cashier doesn't have to remember/type the per-hour rate. Fetched
  // alongside time packages on mount.
  const [branch, setBranch] = useState<IBranchApi | null>(null);

  useEffect(() => { void sessionRepository.listPackages(branchId).then((p) => { setPackages(p); setPkgId(p[0]?.id ?? null); }); }, [branchId]);
  useEffect(() => {
    let cancelled = false;
    void branchRepository.byId(branchId).then((b) => {
      if (!cancelled) setBranch(b);
    }).catch(() => {
      // Branch fetch is best-effort — if it fails, the open-mode body
      // falls back to the manual rate input alone.
      if (!cancelled) setBranch(null);
    });
    return () => { cancelled = true; };
  }, [branchId]);

  // Visible tariff options for the open-mode picker. PC-kind PCs get
  // the 2 PC variants; PS-kind PCs get all 4 PS variants since the
  // PC row doesn't distinguish ps4 from ps5. Empty when the branch
  // has no priceForBranch row or no rates for the relevant variants.
  const tariffOptions = useMemo(() => {
    const matrix = branch?.price_for_branch;
    if (!matrix) return [];
    type Row = { key: string; label: string; rate: number };
    const keys: { key: keyof NonNullable<IBranchApi["price_for_branch"]>; label: string }[] =
      pc.kind === "ps"
        ? [
            { key: "ps4-standard", label: "PS4 · Standard" },
            { key: "ps4-vip", label: "PS4 · VIP" },
            { key: "ps5-standard", label: "PS5 · Standard" },
            { key: "ps5-vip", label: "PS5 · VIP" },
          ]
        : [
            { key: "pc-standard", label: "PC · Standard" },
            { key: "pc-vip", label: "PC · VIP" },
          ];
    const rows: Row[] = [];
    for (const { key, label } of keys) {
      const v = matrix[key];
      if (v != null && Number(v) > 0) rows.push({ key: String(key), label, rate: Number(v) });
    }
    return rows;
  }, [branch, pc.kind]);

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
              <div className="col" style={{ gap: 10 }}>
                {tariffOptions.length > 0 && (
                  <div className="col" style={{ gap: 6 }}>
                    <span className="label">{t("session.tariffField")}</span>
                    <div className="col" style={{ gap: 6 }}>
                      {tariffOptions.map((opt) => {
                        const active = String(opt.rate) === rate;
                        return (
                          <label key={opt.key} style={pkgRow(active)}>
                            <input
                              type="radio"
                              name="open-tariff"
                              checked={active}
                              onChange={() => setRate(String(opt.rate))}
                            />
                            <span style={{ flex: 1 }}>{opt.label}</span>
                            <span style={{ fontWeight: 700 }}>
                              {money(opt.rate)} / {t("time.hourShort") || "h"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
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
