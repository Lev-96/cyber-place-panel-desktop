import { apiWakePc } from "@/api/pcs";
import PairingTokenModal from "@/components/pcs/PairingTokenModal";
import PcForm from "@/components/pcs/PcForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
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

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;

  const remove = async (pc: IPcApi) => {
    if (!confirm(`Delete ${pc.label}? This cannot be undone.`)) return;
    await pcRepository.remove(pc.id);
    void reload();
  };

  const rotate = async (pc: IPcApi) => {
    if (!confirm(`Rotate pairing token for ${pc.label}? The agent on this PC will stop working until updated.`)) return;
    const updated = await pcRepository.rotateToken(pc.id);
    setTokenPc(updated);
    void reload();
  };

  const wake = async (pc: IPcApi) => {
    if (!pc.mac_address) {
      alert("Set a MAC address on this PC before using Wake-on-LAN.");
      return;
    }
    setWaking(pc.id);
    try {
      // Prefer local Electron transport — same LAN as the gaming PCs, broadcast actually reaches them.
      // Fall back to backend endpoint when running in a browser (no desktopAPI bridge).
      if (window.desktopAPI?.wakeOnLan) {
        const r = await window.desktopAPI.wakeOnLan(pc.mac_address);
        const lines = [r.message];
        if (r.sent) lines.push(`Packets sent: ${r.sent}`);
        if (r.errors.length) lines.push("", "Errors:", ...r.errors);
        lines.push("", "PC must have Wake-on-LAN enabled in BIOS and NIC settings, and be on the same LAN as this cashier.");
        alert(lines.join("\n"));
      } else {
        const r = await apiWakePc(pc.id);
        const lines = [r.message];
        if (r.sent_packets) lines.push(`Packets sent: ${r.sent_packets}`);
        if (r.note) lines.push("", r.note);
        if (r.errors?.length) lines.push("", "Errors:", ...r.errors);
        alert(lines.join("\n"));
      }
    } catch (e) {
      alert(`Wake failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally { setWaking(null); }
  };

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("pcs.title")} · #{id}</h2>
        <Button onClick={() => setCreating(true)}>{t("pcs.register")}</Button>
      </div>

      <div className="card" style={{ borderLeft: "3px solid #07ddf1", fontSize: 13 }}>
        <b>How a PC actually connects:</b>
        <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
          <li>Register the PC here — you get a <b>pairing token</b>.</li>
          <li>Install <code>cyber-place-panel-client-agent</code> on the PC and enter the PC ID + token.</li>
          <li>The MAC address is optional — used only for <b>Wake-on-LAN</b>, not for authentication.</li>
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
                  <StatusDot status={pc.status} /> {pc.status}
                  {pc.hourly_rate != null && <> · {Number(pc.hourly_rate)} /ч</>}
                  {!isPs && pc.mac_address && <> · MAC: {pc.mac_address}</>}
                  {!isPs && (pc.last_seen_at
                    ? <> · last seen {new Date(pc.last_seen_at).toLocaleString()}</>
                    : <> · <span style={{ color: "#f59e0b" }}>not paired yet — install agent</span></>
                  )}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {!isPs && pc.mac_address && (
                  <Button variant="secondary" onClick={() => wake(pc)} disabled={waking === pc.id} style={btn}>
                    {waking === pc.id ? "Sending…" : "Wake"}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setEditing(pc)} style={btn}>Edit</Button>
                {!isPs && (
                  <Button variant="secondary" onClick={() => rotate(pc)} style={btn}>
                    {neverPaired ? "Get token" : "Rotate token"}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => remove(pc)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>Delete</Button>
              </div>
            </div>
            );
          })}
          {!pcs?.length && <div className="muted">No PCs registered yet. Click "Register PC" to add the first one.</div>}
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
