import { apiWakePc } from "@/api/pcs";
import PairingTokenModal from "@/components/pcs/PairingTokenModal";
import PcForm from "@/components/pcs/PcForm";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { notify } from "@/ui/notify";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { pcRepository } from "@/repositories/PcRepository";
import { IPcApi } from "@/types/sessions";
import { isPs, pcHasAgent, PC_STATUS } from "@/types/pc";
import { useState } from "react";
import { useParams } from "react-router-dom";

const PcsList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const confirm = useConfirm();
  const { data: pcs, loading, error, reload } = useAsync(() => pcRepository.listByBranch(id), [id]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IPcApi | null>(null);
  const [tokenPc, setTokenPc] = useState<IPcApi | null>(null);
  const [waking, setWaking] = useState<number | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const remove = async (pc: IPcApi) => {
    if (!(await confirm(fmt(t("pcs.confirmDelete"), pc.label), { destructive: true }))) return;
    await pcRepository.remove(pc.id);
    void reload();
  };

  const rotate = async (pc: IPcApi) => {
    if (!(await confirm(fmt(t("pcs.confirmRotate"), pc.label)))) return;
    const updated = await pcRepository.rotateToken(pc.id);
    setTokenPc(updated);
    void reload();
  };

  const wake = async (pc: IPcApi) => {
    if (!pc.mac_address) {
      notify.message("error", t("pcs.macRequired"));
      return;
    }
    setWaking(pc.id);
    try {
      // Prefer local Electron transport — same LAN as the gaming PCs, broadcast actually reaches them.
      // Fall back to backend endpoint when running in a browser (no desktopAPI bridge).
      if (window.desktopAPI?.wakeOnLan) {
        const r = await window.desktopAPI.wakeOnLan(pc.mac_address);
        const parts = [r.message];
        if (r.sent) parts.push(fmt(t("pcs.packetsSent"), r.sent));
        notify.message(r.ok ? "success" : "error", parts.join(" · "));
      } else {
        const r = await apiWakePc(pc.id);
        const parts = [r.message];
        if (r.sent_packets) parts.push(fmt(t("pcs.packetsSent"), r.sent_packets));
        notify.message("success", parts.join(" · "));
      }
    } catch (e) {
      notify.message("error", fmt(t("pcs.wakeFailed"), e instanceof Error ? e.message : t("shift.failed")));
    } finally { setWaking(null); }
  };

  // A PS/console has no kiosk agent to report a heartbeat, so the "offline"
  // (agent-not-connected) state never applies to it — it is always available
  // for billing. Coerce any stale/legacy PS 'offline' to 'online' for display
  // so the operator never sees a misleading Offline badge. PCs keep the full
  // three-state semantics, where 'offline' legitimately means "agent absent".
  const effectiveStatus = (pc: IPcApi): IPcApi["status"] =>
    isPs(pc.kind) && pc.status === PC_STATUS.Offline ? PC_STATUS.Online : pc.status;

  const statusLabel = (s: IPcApi["status"]): string =>
    s === PC_STATUS.InSession ? t("pcs.statusInSession") : s === PC_STATUS.Online ? t("pcs.statusOnline") : t("pcs.statusOffline");

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("pcs.title")} · №{id}</h2>
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

      {loading && <ListSkeleton />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(pcs ?? []).map((pc) => {
            const neverPaired = !pc.last_seen_at;
            const isPsDevice = isPs(pc.kind);
            return (
            <div key={pc.id} className="list-item">
              <div>
                <div className="name">
                  {pc.label}
                  {pc.place && (
                    <span className="muted" style={{ marginLeft: 6 }}>№{pc.place.number ?? pc.place.id}</span>
                  )}
                  {isPsDevice && <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#101a35", color: "#d152fa" }}>PS</span>}
                </div>
                <div className="meta">
                  <StatusDot status={effectiveStatus(pc)} /> {statusLabel(effectiveStatus(pc))}
                  {pc.hourly_rate != null && <> · {Number(pc.hourly_rate)} /{t("time.hourShort")}</>}
                  {!isPsDevice && pc.mac_address && <> · MAC: {pc.mac_address}</>}
                  {!isPsDevice && (pc.last_seen_at
                    ? <> · {t("pcs.lastSeen")} {formatDateTime(pc.last_seen_at)}</>
                    : <> · <span style={{ color: "#f59e0b" }}>{t("pcs.notPaired")}</span></>
                  )}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {!isPsDevice && pc.mac_address && (
                  <Button variant="secondary" onClick={() => wake(pc)} disabled={waking === pc.id} style={btn}>
                    {waking === pc.id ? t("pcs.sending") : t("pcs.wake")}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setEditing(pc)} style={btn}>{t("action.edit")}</Button>
                {!isPsDevice && (
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
            if (pcHasAgent(pc.kind)) setTokenPc(pc);
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
  const color = status === PC_STATUS.InSession ? "#ef4444" : status === PC_STATUS.Online ? "#22c55e" : "#6b7280";
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: color, marginRight: 4 }} />;
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12 };

export default PcsList;
