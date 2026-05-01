import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { shiftRepository } from "@/repositories/ShiftRepository";
import { useState } from "react";
import { useParams } from "react-router-dom";

const ShiftPanel = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const { data, loading, error, reload } = useAsync(() => shiftRepository.current(id), [id]);
  const [openingCash, setOpeningCash] = useState("0");
  const [declared, setDeclared] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;
  if (loading) return <Spinner />;
  if (error) return <div className="error">{error.message}</div>;

  const open = async () => {
    setBusy(true); setMsg(null);
    try { await shiftRepository.open(id, Number(openingCash) || 0); void reload(); }
    catch (e) { setMsg(e instanceof Error ? e.message : t("shift.failed")); }
    finally { setBusy(false); }
  };

  const close = async () => {
    if (!data?.shift) return;
    if (!confirm(t("shift.confirmClose"))) return;
    setBusy(true); setMsg(null);
    try {
      await shiftRepository.close(data.shift.id, declared ? Number(declared) : undefined, notes || undefined);
      setDeclared(""); setNotes("");
      void reload();
    } catch (e) { setMsg(e instanceof Error ? e.message : t("shift.failed")); }
    finally { setBusy(false); }
  };

  if (!data?.shift) {
    return (
      <div className="col" style={{ gap: 18, maxWidth: 480 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{t("shift.title")} #{id}</h2>
        <div className="card col" style={{ gap: 12 }}>
          <div className="muted">{t("shift.noActive")}</div>
          <Input label={t("shift.openingCash")} type="number" min={0} step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
          {msg && <div className="error">{msg}</div>}
          <Button onClick={open} disabled={busy}>{busy ? t("shift.opening") : t("shift.open")}</Button>
        </div>
      </div>
    );
  }

  const s = data.shift;
  const sum = data.summary;
  return (
    <div className="col" style={{ gap: 18, maxWidth: 600 }}>
      <h2 className="page-title" style={{ margin: 0 }}>{t("shift.title")} #{id}</h2>
      <div className="card col" style={{ gap: 8 }}>
        <Row k={t("shift.opened")} v={formatDateTime(s.opened_at)} />
        <Row k={t("shift.openingCash")} v={Number(s.opening_cash).toFixed(2)} />
        {sum && (
          <>
            <div className="divider" />
            <Row k={t("shift.sessionsRevenue")} v={Number(sum.sessions_total).toFixed(2)} />
            <Row k={t("shift.ordersCash")} v={Number(sum.orders_cash).toFixed(2)} />
            <Row k={t("shift.ordersCard")} v={Number(sum.orders_card).toFixed(2)} />
            <Row k={t("shift.ordersDeposit")} v={Number(sum.orders_deposit).toFixed(2)} />
            <div className="divider" />
            <Row k={t("shift.expectedCash")} v={Number(sum.expected_cash).toFixed(2)} highlight />
            <Row k={t("shift.grossTotal")} v={Number(sum.gross_total).toFixed(2)} />
          </>
        )}
      </div>
      <div className="card col" style={{ gap: 10 }}>
        <h3 style={{ margin: 0 }}>{t("shift.closeTitle")}</h3>
        <Input label={t("shift.declaredCash")} type="number" min={0} step="0.01" value={declared} onChange={(e) => setDeclared(e.target.value)} />
        <Input label={t("shift.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {msg && <div className="error">{msg}</div>}
        <Button onClick={close} disabled={busy}>{busy ? t("shift.closing") : t("shift.close")}</Button>
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
