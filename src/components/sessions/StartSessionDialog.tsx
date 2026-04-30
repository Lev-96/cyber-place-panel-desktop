import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ITimePackage } from "@/types/sessions";
import { useEffect, useRef, useState } from "react";

interface Props {
  branchId: number;
  pc: IPcApi;
  onClose: () => void;
  onStarted: () => void;
}

const StartSessionDialog = ({ branchId, pc, onClose, onStarted }: Props) => {
  const [packages, setPackages] = useState<ITimePackage[] | null>(null);
  const [pkgId, setPkgId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { void sessionRepository.listPackages(branchId).then((p) => { setPackages(p); setPkgId(p[0]?.id ?? null); }); }, [branchId]);

  // Focus the name input as soon as packages load. Without this, focus stays
  // wherever the previous native confirm() left it — making the input feel
  // unresponsive on the second open after a stop.
  useEffect(() => {
    if (packages && nameRef.current) nameRef.current.focus();
  }, [packages]);

  const submit = async () => {
    if (!pkgId) return;
    setBusy(true); setErr(null);
    try {
      await sessionRepository.start({ branch_id: branchId, pc_id: pc.id, time_package_id: pkgId, user_display_name: name || undefined });
      onStarted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to start");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ margin: 0 }}>Start session · {pc.label}</h2>
        {!packages ? <Spinner /> : (
          <>
            <Input ref={nameRef} label="Customer name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="col" style={{ gap: 6 }}>
              <span className="label">Time package</span>
              <div className="col" style={{ gap: 6 }}>
                {packages.map((p) => (
                  <label key={p.id} style={pkgRow(p.id === pkgId)}>
                    <input type="radio" name="pkg" value={p.id} checked={p.id === pkgId} onChange={() => setPkgId(p.id)} />
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <span className="muted">{p.duration_minutes} min</span>
                    <span style={{ fontWeight: 700 }}>{Number(p.price).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="row-between">
              <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={submit} disabled={busy || !pkgId}>{busy ? "Starting…" : "Start"}</Button>
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

export default StartSessionDialog;
