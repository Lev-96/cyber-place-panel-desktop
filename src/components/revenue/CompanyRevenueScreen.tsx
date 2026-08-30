import { SkeletonStats } from "@/components/ui/Skeleton";
import { apiCompanyRevenueSummary, ICompanyRevenueSummary } from "@/api/billing";
import Spinner from "@/components/ui/Spinner";
import { formatMonth } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { useCallback, useEffect, useState } from "react";

interface Props {
  companyId: number;
  companyName?: string;
  initialPercent?: number;
}

const currentMonth = () => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};
/** Local-time month boundaries → UTC ISO so backend uses cashier's calendar month. */
const monthBoundsIso = (sel: { year: number; month: number }) => {
  const start = new Date(sel.year, sel.month - 1, 1, 0, 0, 0, 0);
  const end = new Date(sel.year, sel.month, 0, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
};

const CompanyRevenueScreen = ({ companyId, companyName, initialPercent }: Props) => {
  const { t, money } = useLang();
  const [percent, setPercent] = useState(initialPercent ?? 0);
  const [opRevenue, setOpRevenue] = useState<ICompanyRevenueSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState(currentMonth());

  // The company record is the only source. It used to fall back to a percent
  // kept in browser storage, which meant two machines could disagree about
  // what a company owes — and the server, which does the arithmetic that
  // matters, was never asked.
  useEffect(() => {
    if (initialPercent != null && Number.isFinite(initialPercent)) setPercent(initialPercent);
  }, [companyId, initialPercent]);

  const reload = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const bounds = monthBoundsIso(sel);
      setOpRevenue(await apiCompanyRevenueSummary(companyId, bounds));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load report");
    } finally { setLoading(false); }
  }, [companyId, sel, percent]);

  useEffect(() => { void reload(); }, [reload, percent]);

  const monthLabel = formatMonth(new Date(sel.year, sel.month - 1, 1));
  const shift = (delta: number) => {
    const d = new Date(sel.year, sel.month - 1 + delta, 1);
    setSel({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  return (
    <div className="col" style={{ gap: 18 }}>
      <h2 className="page-title" style={{ margin: 0 }}>
        {(companyName ?? `№${companyId}`) + " · " + t("revenue.title")}
      </h2>

      <div className="month-picker">
        <button className="month-btn" onClick={() => shift(-1)}>‹</button>
        <span className="month-label">{monthLabel}</span>
        <button className="month-btn" onClick={() => shift(1)}>›</button>
      </div>

      {loading && <SkeletonStats tiles={3} />}
      {err && <div className="error">{err}</div>}

      {opRevenue && !loading && (
        <div className="card col" style={{ gap: 6 }}>
          <div className="kv-row" style={{ fontWeight: 700 }}>
            <span className="k">{t("revenue.operationalTitle")}</span>
            <span className="v" />
          </div>
          <Row k={t("revenue.closedSessions")} v={String(opRevenue.sessions_count ?? 0)} />
          <Row k={t("revenue.sourceSessions")} v={money(opRevenue.sessions_total)} />
          {/* Till takings only ever appear for a month that had any: the
              section is gone, so for every month from here it is zero and a
              row of zeroes is a question nobody needs to ask. */}
          {opRevenue.pos_total > 0 && <Row k={t("revenue.sourcePos")} v={money(opRevenue.pos_total)} />}
          <div className="divider" />
          <Row k={t("revenue.gross")} v={money(opRevenue.gross_total)} />
          <Row k={t("revenue.commissionPercent")} v={`${opRevenue.commission_percent}%`} />
          <Row k={t("revenue.amountOwed")} v={money(opRevenue.commission_amount)} highlight />
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
