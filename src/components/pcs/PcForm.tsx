import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { pcRepository } from "@/repositories/PcRepository";
import { IPcApi } from "@/types/sessions";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  initial?: IPcApi;
  onClose: () => void;
  onSaved: (pc: IPcApi) => void;
}

const PcForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [mac, setMac] = useState(initial?.mac_address ?? "");
  const [placeId, setPlaceId] = useState<string>(initial?.place_id ? String(initial.place_id) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const place_id = placeId ? Number(placeId) : null;
      const pc = initial
        ? await pcRepository.update(initial.id, { label, mac_address: mac || null, place_id })
        : await pcRepository.create({ branch_id: branchId, label, mac_address: mac || null, place_id });
      onSaved(pc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally { setBusy(false); }
  };

  return (
    <div style={overlay}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? "Edit PC" : "Register new PC"}</h2>
        <Input label="Label (e.g. PC #5)" value={label} onChange={(e) => setLabel(e.target.value)} required autoFocus />
        <Input label="MAC address (optional)" value={mac ?? ""} onChange={(e) => setMac(e.target.value)} />
        <Input label="Linked place id (optional)" type="number" value={placeId} onChange={(e) => setPlaceId(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy || !label}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(2,5,20,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
};

export default PcForm;
