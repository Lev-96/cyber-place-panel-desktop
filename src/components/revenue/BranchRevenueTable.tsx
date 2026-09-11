import type { IBranchRevenueSummary } from "@/api/billing";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { useId } from "react";

/**
 * The month's figures per branch, one row each, in the server's order (branch
 * id; every branch listed, zero rows included, so the table keeps its shape
 * from month to month).
 *
 * Every cell is the row's own key. A branch's commission is on its whole
 * takings, tournaments included, and may differ from its share of the company
 * commission by a rounding hundredth — so there is deliberately no totals row
 * adding the column up: the company figures are in the card above, and they
 * are the authoritative ones.
 */
const BranchRevenueTable = ({ branches }: { branches: IBranchRevenueSummary[] }) => {
  const { t, money } = useLang();
  const titleId = useId();
  // Same rule as the summary: the till is gone, so its column appears only
  // for a month in which some branch actually took till money.
  const showPos = branches.some((b) => b.pos_total > 0);

  return (
    <section className="card col revenue-card">
      <h3 id={titleId} className="revenue-card-title">{t("revenue.byBranch")}</h3>
      <div className="revenue-table-scroll">
        <table className="revenue-table" aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">{t("revenue.colBranch")}</th>
              <th scope="col" className="num">{t("revenue.sourceSessions")}</th>
              {showPos && <th scope="col" className="num">{t("revenue.sourcePos")}</th>}
              <th scope="col" className="num">{t("revenue.colTournaments")}</th>
              <th scope="col" className="num">{t("revenue.totalRevenue")}</th>
              <th scope="col" className="num">{t("revenue.cyberPlaceCommission")}</th>
              <th scope="col" className="num">{t("revenue.ownerIncome")}</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.branch_id}>
                <th scope="row">{b.address || `№${b.branch_id}`}</th>
                <td className="num">
                  {money(b.sessions_total)}
                  <span className="revenue-table-sub">{fmt(t("revenue.closedCount"), b.sessions_count)}</span>
                </td>
                {showPos && <td className="num">{money(b.pos_total)}</td>}
                <td className="num">
                  {money(b.tournaments_total)}
                  <span className="revenue-table-sub">{fmt(t("revenue.entriesCount"), b.tournaments_count)}</span>
                </td>
                <td className="num">{money(b.total_gross)}</td>
                <td className="num">{money(b.commission_amount)}</td>
                <td className="num">{money(b.owner_income)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default BranchRevenueTable;
