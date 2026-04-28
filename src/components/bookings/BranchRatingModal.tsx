import { apiRateBranch } from "@/api/bookings";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  onClose: () => void;
  onDone: () => void;
}

const BranchRatingModal = ({ branchId, onClose, onDone }: Props) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await apiRateBranch({ branch_id: branchId, rating, comment: comment || undefined }); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>Rate branch</h2>
        <div className="col" style={{ gap: 6 }}>
          <span className="label">Stars</span>
          <div className="row" style={{ gap: 6, fontSize: 32 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} style={{ background: "transparent", border: "none", cursor: "pointer", color: n <= rating ? "#f59e0b" : "#1f2a44", lineHeight: 1 }}>★</button>
            ))}
          </div>
        </div>
        <Input label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy}>{busy ? "Sending…" : "Submit rating"}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default BranchRatingModal;
