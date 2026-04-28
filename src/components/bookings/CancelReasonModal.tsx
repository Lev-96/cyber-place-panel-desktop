import { apiDeleteBooking } from "@/api/bookings";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { FormEvent, useState } from "react";

interface Props {
  bookingId: number;
  onClose: () => void;
  onDone: () => void;
}

const CancelReasonModal = ({ bookingId, onClose, onDone }: Props) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await apiDeleteBooking(bookingId); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>Cancel booking #{bookingId}</h2>
        <Input label="Reason (optional, kept for your records)" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <span className="muted" style={{ fontSize: 11 }}>Backend doesn't currently store reason — this stays in your local notes only.</span>
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Keep booking</Button>
          <Button disabled={busy} style={{ background: "#ef4444", color: "#fff" }}>{busy ? "Cancelling…" : "Cancel booking"}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CancelReasonModal;
