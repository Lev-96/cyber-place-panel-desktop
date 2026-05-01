import { apiWakePc } from "@/api/pcs";
import PairingTokenModal from "@/components/pcs/PairingTokenModal";
import PcForm from "@/components/pcs/PcForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { pcRepository } from "@/repositories/PcRepository";
import { IPcApi } from "@/types/sessions";
import { useState } from "react";
import { useParams } from "react-router-dom";

const PcsList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const { data: pcs, loading, error, reload } = useAsync(() => pcRepository.listByBranch(id), [id]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IPcApi | null>(null);
  const [tokenPc, setTokenPc] = useState<IPcApi | null>(null);
  const [waking, setWaking] = useState<number | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const remove = async (pc: IPcApi) => {
    if (!confirm(fmt(t("pcs.confirmDelete"), pc.label))) return;
    await pcRepository.remove(pc.id);
    void reload();
  };

  const rotate = async (pc: IPcApi) => {
    if (!confirm(fmt(t("pcs.confirmRotate"), pc.label))) return;
    const updated = await pcRepository.rotateToken(pc.id);
    setTokenPc(updated);
    void reload();
  };

  const wake = async (pc: IPcApi) => {
    if (!pc.mac_address) {
      alert(t("pcs.macRequired"));
      return;
    }
    setWaking(pc.id);
    try {
      // Prefer local Electron transport — same LAN as the gaming PCs, broadcast actually reaches them.
      // Fall back to backend endpoint when running in a browser (no desktopAPI bridge).
      if (window.desktopAPI?.wakeOnLan) {
        const r = await window.desktopAPI.wakeOnLan(pc.mac_address);
        const lines = [r.message];
        if (r.sent) lines.push(fmt(t("pcs.packetsSent"), r.sent));
        if (r.errors.length) lines.push("", t("pcs.errorsHeader"), ...r.errors);
        lines.push("", t("pcs.wolReminder"));
        alert(lines.join("\n"));
      } else {
        const r = await apiWakePc(pc.id);
        const lines = [r.message];
        if (r.sent_packets) lines.push(fmt(t("pcs.packetsSent"), r.sent_packets));
        if (r.note) lines.push("", r.note);
        if (r.errors?.length) lines.push("", t("pcs.errorsHeader"), ...r.errors);
        alert(lines.join("\n"));
      }
    } catch (e) {
      alert(fmt(t("pcs.wakeFailed"), e instanceof Error ? e.message : t("shift.failed")));
    } finally { setWaking(null); }
  };

  const statusLabel = (s: IPcApi["status"]): string =>
    s === "in_session" ? t("pcs.statusInSession") : s === "online" ? t("pcs.statusOnline") : t("pcs.statusOffline");

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("pcs.title")} · #{id}</h2>
        <Button onClick={() => setCreating(true)}>{t("pcs.register")}</Button>
      </div>

      <div className="card" style={{ borderLeft: "3px solid #07ddf1", fontSize: 13 }}>
        <b>{t("pcs.howConnects")}</b>
        <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
          <li>{t("pcs.connect.step1")}</li>
          <li>{t("pcs.connect.step2")}</li>
          <li>{t("pcs.connect.step3")}</li>
        </ol>
      </div>

      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(pcs ?? []).map((pc) => {
            const neverPaired = !pc.last_seen_at;
            const isPs = pc.kind === "ps";
            return (
            <div key={pc.id} className="list-item">
              <div>
                <div className="name">
                  {pc.label} <span className="muted">#{pc.id}</span>
                  {isPs && <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#101a35", color: "#d152fa" }}>PS</span>}
                </div>
                <div className="meta">
                  <StatusDot status={pc.status} /> {statusLabel(pc.status)}
                  {pc.hourly_rate != null && <> · {Number(pc.hourly_rate)} /{t("time.hourShort")}</>}
                  {!isPs && pc.mac_address && <> · MAC: {pc.mac_address}</>}
                  {!isPs && (pc.last_seen_at
                    ? <> · {t("pcs.lastSeen")} {formatDateTime(pc.last_seen_at)}</>
                    : <> · <span style={{ color: "#f59e0b" }}>{t("pcs.notPaired")}</span></>
                  )}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {!isPs && pc.mac_address && (
                  <Button variant="secondary" onClick={() => wake(pc)} disabled={waking === pc.id} style={btn}>
                    {waking === pc.id ? t("pcs.sending") : t("pcs.wake")}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setEditing(pc)} style={btn}>{t("action.edit")}</Button>
                {!isPs && (
                  <Button variant="secondary" onClick={() => rotate(pc)} style={btn}>
                    {neverPaired ? t("pcs.getToken") : t("pcs.rotateToken")}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => remove(pc)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>{t("action.delete")}</Button>
              </div>
            </div>
            );
          })}
          {!pcs?.length && <div className="muted">{t("pcs.empty")}</div>}
        </div>
      )}

      {creating && (
        <PcForm
          branchId={id}
          onClose={() => setCreating(false)}
          onSaved={(pc) => {
            setCreating(false);
            // PS devices don't run an agent — there's no token to display.
            if (pc.kind !== "ps") setTokenPc(pc);
            void reload();
          }}
        />
      )}
      {editing && (
        <PcForm
          branchId={id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
      {tokenPc && (
        <PairingTokenModal pc={tokenPc} onClose={() => setTokenPc(null)} />
      )}
    </div>
  );
};

const StatusDot = ({ status }: { status: IPcApi["status"] }) => {
  const color = status === "in_session" ? "#ef4444" : status === "online" ? "#22c55e" : "#6b7280";
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: color, marginRight: 4 }} />;
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12 };

export default PcsList;
