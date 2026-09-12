import type { RevenueFigures } from "@/components/revenue/revenueFigures";
import { centsWhenFractional } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";
import { useId } from "react";

interface Props {
  /** The figures to print, already picked from the server's keys (`revenueFigures.ts`). */
  figures: RevenueFigures;
  /** The card heading; also the region's accessible name. */
  title: string;
}

/**
 * A month in one card: where the money came from, the total, and how it
 * splits between Cyber Place and the owner. The same card for the whole
 * company and for one branch; only the figures and the title change.
 *
 * ## Every figure is printed as it came
 * Which server key feeds which row (and the fallbacks for an older backend)
 * is decided in `revenueFigures.ts`. Nothing is derived here.
 *
 * ## Printed to the hundredth when the server's figure has one
 * The figures are exact to the cent and are read against each other; rounded
 * to whole units 9000.50 / 900.05 / 8100.45 read "9,001 - 900 = 8,100".
 * `centsWhenFractional` decides per figure: formatting only, no arithmetic.
 */
const RevenueSummaryCard = ({ figures: f, title }: Props) => {
  const { t, money } = useLang();
  const titleId = useId();
  const amount = (value: number) => money(value, centsWhenFractional(value));

  return (
    <section className="card col revenue-card" aria-labelledby={titleId}>
      <h3 id={titleId} className="revenue-card-title">{title}</h3>

      <Row k={t("revenue.closedSessions")} v={String(f.sessionsCount)} />
      <Row k={t("revenue.sourceSessions")} v={amount(f.sessionsTotal)} />
      {/* Till takings only ever appear for a month that had any: the
          section is gone, so for every month from here it is zero and a
          row of zeroes is a question nobody needs to ask. */}
      {f.posTotal > 0 && <Row k={t("revenue.sourcePos")} v={amount(f.posTotal)} />}
      {/* Tournament fees are a live source, so a month without any shows
          zeros: the card keeps its shape from one month to the next. */}
      {f.tournaments && (
        <>
          <Row k={t("revenue.tournamentEntries")} v={String(f.tournaments.count)} />
          <Row k={t("revenue.sourceTournaments")} v={amount(f.tournaments.total)} />
        </>
      )}

      <div className="divider" />
      <Row k={t("revenue.totalRevenue")} v={amount(f.totalRevenue)} />
      <Row k={t("revenue.cyberPlaceCommission")} v={`${f.commissionPercent}%`} />
      <Row k={t("revenue.amountOwed")} v={amount(f.owed)} highlight />
      {f.ownerIncome != null && <Row k={t("revenue.ownerIncome")} v={amount(f.ownerIncome)} />}
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
