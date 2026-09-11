import type { ICompanyRevenueSummary } from "@/api/billing";
import { useLang } from "@/i18n/LanguageContext";
import { useId } from "react";

/**
 * The company's month in one card: where the money came from, the total, and
 * how it splits between Cyber Place and the owner.
 *
 * ## Every figure is one of the server's keys, printed as it came
 * The keys added with tournament fees (`tournaments_*`, `total_gross`,
 * `total_commission_amount`, `owner_income`) are missing on an older backend.
 * Each then falls back to the key that meant the same thing before tournament
 * fees existed — `gross_total` WAS the whole takings and `commission_amount`
 * WAS what was owed — or its row is left out. None is derived here: owner
 * income as "total minus commission" would be a second copy of a server
 * formula, and would drift from it the first time its rounding changes.
 */
const RevenueSummaryCard = ({ summary }: { summary: ICompanyRevenueSummary }) => {
  const { t, money } = useLang();
  const titleId = useId();

  const { tournaments_count: tournamentsCount, tournaments_total: tournamentsTotal } = summary;
  const totalRevenue = summary.total_gross ?? summary.gross_total;
  const owed = summary.total_commission_amount ?? summary.commission_amount;

  return (
    <section className="card col revenue-card" aria-labelledby={titleId}>
      <h3 id={titleId} className="revenue-card-title">{t("revenue.summaryTitle")}</h3>

      <Row k={t("revenue.closedSessions")} v={String(summary.sessions_count ?? 0)} />
      <Row k={t("revenue.sourceSessions")} v={money(summary.sessions_total)} />
      {/* Till takings only ever appear for a month that had any: the
          section is gone, so for every month from here it is zero and a
          row of zeroes is a question nobody needs to ask. */}
      {summary.pos_total > 0 && <Row k={t("revenue.sourcePos")} v={money(summary.pos_total)} />}
      {/* Tournament fees are a live source, so a month without any shows
          zeros — the card keeps its shape from one month to the next. */}
      {tournamentsCount != null && tournamentsTotal != null && (
        <>
          <Row k={t("revenue.tournamentEntries")} v={String(tournamentsCount)} />
          <Row k={t("revenue.sourceTournaments")} v={money(tournamentsTotal)} />
        </>
      )}

      <div className="divider" />
      <Row k={t("revenue.totalRevenue")} v={money(totalRevenue)} />
      <Row k={t("revenue.cyberPlaceCommission")} v={`${summary.commission_percent}%`} />
      <Row k={t("revenue.amountOwed")} v={money(owed)} highlight />
      {summary.owner_income != null && <Row k={t("revenue.ownerIncome")} v={money(summary.owner_income)} />}
    </section>
  );
};

const Row = ({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) => (
  <div className="kv-row">
    <span className="k">{k}</span>
    <span className={`v ${highlight ? "hi" : ""}`}>{v}</span>
  </div>
);

export default RevenueSummaryCard;
