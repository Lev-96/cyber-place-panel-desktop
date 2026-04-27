import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { shiftRepository } from "@/repositories/ShiftRepository";
import { useState } from "react";
import { useParams } from "react-router-dom";

const ShiftPanel = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { data, loading, error, reload } = useAsync(() => shiftRepository.current(id), [id]);
  const [openingCash, setOpeningCash] = useState("0");
  const [declared, setDeclared] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;
  if (loading) return <Spinner />;
  if (error) return <div className="error">{error.message}</div>;

  const open = async () => {
    setBusy(true); setMsg(null);
    try { await shiftRepository.open(id, Number(openingCash) || 0); void reload(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const close = async () => {
    if (!data?.shift) return;
    if (!confirm("Close this shift? After close it cannot be modified.")) return;
    setBusy(true); setMsg(null);
    try {
      await shiftRepository.close(data.shift.id, declared ? Number(declared) : undefined, notes || undefined);
      setDeclared(""); setNotes("");
      void reload();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  if (!data?.shift) {
    return (
      <div className="col" style={{ gap: 18, maxWidth: 480 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Shift · branch #{id}</h2>
        <div className="card col" style={{ gap: 12 }}>
          <div className="muted">No active shift. Open one to start the day.</div>
          <Input label="Opening cash" type="number" min={0} step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
          {msg && <div className="error">{msg}</div>}
          <Button onClick={open} disabled={busy}>{busy ? "Opening…" : "Open shift"}</Button>
        </div>
      </div>
    );
  }

  const s = data.shift;
  const sum = data.summary;
  return (
    <div className="col" style={{ gap: 18, maxWidth: 600 }}>
      <h2 className="page-title" style={{ margin: 0 }}>Shift · branch #{id}</h2>
      <div className="card col" style={{ gap: 8 }}>
        <Row k="Opened" v={new Date(s.opened_at).toLocaleString()} />
        <Row k="Opening cash" v={Number(s.opening_cash).toFixed(2)} />
        {sum && (
          <>
            <div className="divider" />
            <Row k="Sessions revenue" v={Number(sum.sessions_total).toFixed(2)} />
            <Row k="Orders cash" v={Number(sum.orders_cash).toFixed(2)} />
            <Row k="Orders card" v={Number(sum.orders_card).toFixed(2)} />
            <Row k="Orders deposit" v={Number(sum.orders_deposit).toFixed(2)} />
            <div className="divider" />
            <Row k="Expected cash drawer" v={Number(sum.expected_cash).toFixed(2)} highlight />
            <Row k="Gross total" v={Number(sum.gross_total).toFixed(2)} />
          </>
        )}
      </div>
      <div className="card col" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>Close shift (Z-report)</h3>
        <Input label="Declared cash (counted)" type="number" min={0} step="0.01" value={declared} onChange={(e) => setDeclared(e.target.value)} />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {msg && <div className="error">{msg}</div>}
        <Button onClick={close} disabled={busy}>{busy ? "Closing…" : "Close shift"}</Button>
      </div>
    </div>
  );
};

const Row = ({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) => (
  <div className="kv-row">
    <span className="k">{k}</span>
    <span className={`v ${highlight ? "hi" : ""}`}>{v}</span>
  </div>
);

export default ShiftPanel;
