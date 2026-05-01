import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { branchRepository } from "@/repositories/BranchRepository";
import { IBranchApi } from "@/types/api";
import { FormEvent, useState } from "react";

interface Props {
  /** `days_of_weeks` is now part of IBranchApi itself — no inline intersection needed. */
  branch: IBranchApi;
  onClose: () => void;
  onSaved: () => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const BranchOpenDaysForm = ({ branch, onClose, onSaved }: Props) => {
  const initial = (n: number) => branch.days_of_weeks?.find((d) => d.day_of_week === n);
  const [rows, setRows] = useState(() =>
    DAYS.map((_, i) => {
      const d = initial(i + 1);
      return { day_of_week: i + 1, enabled: !!d, start_time: d?.start_time ?? "10:00", end_time: d?.end_time ?? "23:00" };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const payload = rows.filter((r) => r.enabled).map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }));
      await branchRepository.updateOpenDays(branch.id, payload);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 480, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>Working hours · {branch.address}</h2>
        {rows.map((r, i) => (
          <div key={r.day_of_week} className="row" style={{ gap: 10, alignItems: "center" }}>
            <label className="row" style={{ gap: 6, minWidth: 110 }}>
              <input type="checkbox" checked={r.enabled} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} />
              <span>{DAYS[i]}</span>
            </label>
            <input className="input" type="time" value={r.start_time} disabled={!r.enabled} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x))} />
            <span className="muted">—</span>
            <input className="input" type="time" value={r.end_time} disabled={!r.enabled} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, end_time: e.target.value } : x))} />
          </div>
        ))}
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default BranchOpenDaysForm;
