import { SkeletonStats } from "@/components/ui/Skeleton";
import { apiCompanyRevenueSummary, ICompanyRevenueSummary } from "@/api/billing";
import BranchRevenueTable from "@/components/revenue/BranchRevenueTable";
import RevenueSummaryCard from "@/components/revenue/RevenueSummaryCard";
import Button from "@/components/ui/Button";
import { formatMonth } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { useCallback, useEffect, useRef, useState } from "react";

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

/**
 * A company's takings for one calendar month and what it owes Cyber Place,
 * with a per-branch table when there is more than one branch to compare.
 *
 * Every amount is the server's (`GET /company/{id}/revenue-summary`); this
 * screen formats, it does not add up. See `RevenueSummaryCard` for how it
 * reads an older backend that has no tournament figures yet.
 */
const CompanyRevenueScreen = ({ companyId, companyName, initialPercent }: Props) => {
  const { t } = useLang();
  const [percent, setPercent] = useState(initialPercent ?? 0);
  const [opRevenue, setOpRevenue] = useState<ICompanyRevenueSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState(currentMonth());
  // Only the latest request may land: months flipped quickly would otherwise
  // let a slow earlier answer paint last month's figures under this month.
  const requestSeq = useRef(0);

  // The company record is the only source. It used to fall back to a percent
  // kept in browser storage, which meant two machines could disagree about
  // what a company owes — and the server, which does the arithmetic that
  // matters, was never asked. The percent is never shown or used in any sum
  // (the server's `commission_percent` is); it stays as a reload trigger, so
  // a background refresh of the company record that brings a new rate also
  // re-asks for the summary built on it.
  useEffect(() => {
    if (initialPercent != null && Number.isFinite(initialPercent)) setPercent(initialPercent);
  }, [companyId, initialPercent]);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true); setErr(null);
    try {
      const summary = await apiCompanyRevenueSummary(companyId, monthBoundsIso(sel));
      if (seq === requestSeq.current) setOpRevenue(summary);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      // A failed month must not leave the previous month's figures on screen
      // under the new month's label.
      setOpRevenue(null);
      setErr(e instanceof Error && e.message ? e.message : t("revenue.loadFailed"));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
    // `t` is left out on purpose: a language switch re-labels the screen, it
    // does not need the figures again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, sel, percent]);

  useEffect(() => { void reload(); }, [reload, percent]);

  const monthLabel = formatMonth(new Date(sel.year, sel.month - 1, 1));
  const shift = (delta: number) => {
    const d = new Date(sel.year, sel.month - 1 + delta, 1);
    setSel({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const branches = opRevenue?.branches ?? [];

  return (
    <div className="col" style={{ gap: 18 }}>
      <h2 className="page-title" style={{ margin: 0 }}>
        {(companyName ?? `№${companyId}`) + " · " + t("revenue.title")}
      </h2>

      <div className="month-picker">
        <button className="month-btn" onClick={() => shift(-1)} aria-label={t("revenue.prevMonth")}>‹</button>
        <span className="month-label">{monthLabel}</span>
        <button className="month-btn" onClick={() => shift(1)} aria-label={t("revenue.nextMonth")}>›</button>
      </div>

      {loading && <SkeletonStats tiles={3} />}
      {err && !loading && (
        <div className="row" role="alert">
          <span className="error">{err}</span>
          <Button variant="secondary" onClick={() => void reload()}>{t("revenue.retry")}</Button>
        </div>
      )}

      {opRevenue && !loading && (
        <>
          <RevenueSummaryCard summary={opRevenue} />
          {/* One branch is the whole company: a table repeating the card
              above would be a second copy of the same numbers. */}
          {branches.length > 1 && <BranchRevenueTable branches={branches} />}
        </>
      )}
    </div>
  );
};

export default CompanyRevenueScreen;
