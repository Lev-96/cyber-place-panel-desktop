import PairingTokenModal from "@/components/pcs/PairingTokenModal";
import PcForm from "@/components/pcs/PcForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { pcRepository } from "@/repositories/PcRepository";
import { IPcApi } from "@/types/sessions";
import { useState } from "react";
import { useParams } from "react-router-dom";

const PcsList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { data: pcs, loading, error, reload } = useAsync(() => pcRepository.listByBranch(id), [id]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IPcApi | null>(null);
  const [tokenPc, setTokenPc] = useState<IPcApi | null>(null);

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

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>PCs · branch #{id}</h2>
        <Button onClick={() => setCreating(true)}>+ Register PC</Button>
      </div>

      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(pcs ?? []).map((pc) => (
            <div key={pc.id} className="list-item">
              <div>
                <div className="name">{pc.label} <span className="muted">#{pc.id}</span></div>
                <div className="meta">
                  <StatusDot status={pc.status} /> {pc.status}
                  {pc.mac_address && <> · MAC: {pc.mac_address}</>}
                  {pc.last_seen_at && <> · last seen {new Date(pc.last_seen_at).toLocaleString()}</>}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button variant="secondary" onClick={() => setEditing(pc)} style={btn}>Edit</Button>
                <Button variant="secondary" onClick={() => rotate(pc)} style={btn}>Rotate token</Button>
                <Button variant="secondary" onClick={() => remove(pc)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>Delete</Button>
              </div>
            </div>
          ))}
          {!pcs?.length && <div className="muted">No PCs registered yet. Click "Register PC" to add the first one.</div>}
        </div>
      )}

      {creating && (
        <PcForm
          branchId={id}
          onClose={() => setCreating(false)}
          onSaved={(pc) => { setCreating(false); setTokenPc(pc); void reload(); }}
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
