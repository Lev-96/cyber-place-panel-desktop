import Spinner from "@/components/ui/Spinner";
import { RevenueReport } from "@/domain/Revenue";
import { commissionStore } from "@/services/revenue/CommissionStore";
import { revenueCalculator } from "@/services/revenue/RevenueCalculator";
import { useCallback, useEffect, useState } from "react";
import CommissionInput from "./CommissionInput";

interface Props {
  companyId: number;
  companyName?: string;
  initialPercent?: number;
}

const currentMonth = () => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};
const fmtIso = (d: Date) => d.toISOString().slice(0, 10);

const CompanyRevenueScreen = ({ companyId, companyName, initialPercent }: Props) => {
  const [percent, setPercent] = useState(initialPercent ?? 0);
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState(currentMonth());

  useEffect(() => {
    if (initialPercent != null && Number.isFinite(initialPercent)) {
      setPercent(initialPercent);
      return;
    }
    void commissionStore.getPercent(companyId).then(setPercent);
  }, [companyId, initialPercent]);

  const reload = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await revenueCalculator.forCompanyMonth(companyId, sel, percent);
      setReport(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load report");
    } finally { setLoading(false); }
  }, [companyId, sel, percent]);

  useEffect(() => { void reload(); }, [reload, percent]);

  const onPercent = async (v: number) => {
    setPercent(v);
    await commissionStore.setPercent(companyId, v);
  };

  const monthLabel = new Date(sel.year, sel.month - 1, 1)
    .toLocaleDateString([], { month: "long", year: "numeric" });
  const shift = (delta: number) => {
    const d = new Date(sel.year, sel.month - 1 + delta, 1);
    setSel({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  return (
    <div className="col" style={{ gap: 18 }}>
      <h2 className="page-title" style={{ margin: 0 }}>
        {companyName ? `${companyName} · revenue` : `Company #${companyId} · revenue`}
      </h2>

      <div className="month-picker">
        <button className="month-btn" onClick={() => shift(-1)}>‹</button>
        <span className="month-label">{monthLabel}</span>
        <button className="month-btn" onClick={() => shift(1)}>›</button>
      </div>

      <CommissionInput
        value={percent}
        onChange={onPercent}
        sourceLabel={initialPercent != null ? "From company config" : "Stored locally on this device."}
      />

      {loading && <Spinner />}
      {err && <div className="error">{err}</div>}
      {report && !loading && (
        <div className="card col" style={{ gap: 6 }}>
          <Row k="Period" v={`${fmtIso(report.periodFrom)} — ${fmtIso(report.periodTo)}`} />
          <Row k="Completed bookings" v={String(report.bookingsCount)} />
          <Row k="Gross revenue" v={report.grossRevenue.format()} />
          <div className="divider" />
          <Row k="Commission" v={`${report.commissionPercent}%`} />
          <Row k="Amount due" v={report.amountDue().format()} highlight />
        </div>
      )}
    </div>
  );
};

const Row = ({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) => (
  <div className="kv-row">
    <span className="k">{k}</span>
    <span className={`v ${highlight ? "hi" : ""}`}>{v}</span>
  </div>
);

export default CompanyRevenueScreen;
