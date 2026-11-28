import { signedDelta } from "@/components/products/stock";
import { formatVenueDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { shiftAmount } from "@/shifts/cash";
import {
  type IAcceptanceCount, type IAcceptanceCountBlind, type IAcceptanceCountFull, type IAcceptanceCountRow,
  STOCK_COUNT_OUTCOME, isBlindCount,
} from "@/types/shifts";
import { Section } from "../shiftReportParts";
import { venueMoment, venueSpan } from "./acceptanceCount";

/**
 * «Приём смены» in a shift's report (2026-11-18): the count the shift was
 * accepted with, exactly as the server sent it — nothing is added up here.
 *
 * Owner / admin: who counted and when, the previous shift and whose shelf it
 * was, a gap with no shift, then per product how the books got to «Должно
 * быть» (accepted by the previous shift, received / sold / returned in the
 * program since, «Исправлено» only when some product has one), the count, the
 * difference and what it is worth; a shortage red and named, a surplus named,
 * a first count said to have nothing to compare with; the totals below.
 *
 * Manager: blind, as the server sends it — what was counted, nothing else.
 *
 * Every shortage is also said in one plain sentence (2026-11-28, owner), with
 * the server's figures only. The same shortage is shown on the shift it
 * happened on, in that shift's «Остатки» (`ShiftStockTable`).
 *
 * The table becomes one card per product when its own box is narrow (a
 * container query: the report also sits in a 680px dialog), so no window
 * width scrolls the page sideways.
 */
const ShiftAcceptanceBlock = ({ count }: { count: IAcceptanceCount }) =>
  isBlindCount(count) ? <BlindCount count={count} /> : <FullCount count={count} />;

const CountedBy = ({ count }: { count: IAcceptanceCount }) => {
  const { t } = useLang();
  if (!count.counted_by && !count.counted_at) return null;
  return (
    <span data-testid="shift-acceptance-by">
      {fmt(t("shift.acceptCount.countedBy"), count.counted_by?.name ?? "", count.counted_at ? formatVenueDateTime(count.counted_at) : "")}
    </span>
  );
};

const BlindCount = ({ count }: { count: IAcceptanceCountBlind }) => {
  const { t } = useLang();
  return (
    <Section title={t("shift.accept.title")} testId="shift-acceptance">
      <div className="shift-acceptance__facts">
        <CountedBy count={count} />
        <span className="muted">{t("shift.acceptCount.blindRule")}</span>
      </div>
      <div className="shift-acceptance__box">
        <table className="shift-acceptance__table">
          <thead>
            <tr>
              <th scope="col">{t("shift.acceptCount.product")}</th>
              <th scope="col">{t("shift.acceptCount.counted")}</th>
            </tr>
          </thead>
          <tbody>
            {count.rows.map((r) => (
              <tr key={r.product_id ?? r.name} data-testid="shift-acceptance-row">
                <th scope="row">{r.name}</th>
                <td data-label={t("shift.acceptCount.counted")}>{r.counted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

const FullCount = ({ count }: { count: IAcceptanceCountFull }) => {
  const { t, money } = useLang();
  const m = (amount: string) => shiftAmount(money, amount);
  const showCorrected = count.rows.some((r) => (r.flow?.corrected ?? 0) !== 0);
  const prev = count.previous_shift;
  const { totals } = count;
  const hasShortage = Number(totals.shortage_value) > 0 || totals.shortage_products > 0;
  const hasSurplus = Number(totals.surplus_value) > 0 || totals.surplus_products > 0;

  const head: Array<[string, string]> = [
    ["accepted", t("shift.acceptCount.accepted")],
    ["received", t("shift.acceptCount.received")],
    ["sold", t("shift.acceptCount.sold")],
    ["returned", t("shift.acceptCount.returned")],
    ...(showCorrected ? [["corrected", t("shift.acceptCount.corrected")] as [string, string]] : []),
    ["expected", t("shift.acceptCount.expected")],
    ["counted", t("shift.acceptCount.counted")],
    ["diff", t("shift.acceptCount.diff")],
    ["value", t("shift.acceptCount.value")],
  ];
  const label = (key: string) => head.find(([k]) => k === key)?.[1] ?? "";
  const shortages = count.rows.filter((r) => r.outcome === STOCK_COUNT_OUTCOME.shortage);

  return (
    <Section title={t("shift.accept.title")} testId="shift-acceptance">
      <div className="shift-acceptance__facts">
        <CountedBy count={count} />
        {prev ? (
          <span data-testid="shift-acceptance-previous">
            {fmt(t("shift.acceptCount.previous"), prev.opened_by?.name ?? "", venueSpan(prev.opened_at, prev.closed_at))}
          </span>
        ) : (
          <span className="muted" data-testid="shift-acceptance-previous">{t("shift.acceptCount.noPrevious")}</span>
        )}
        {count.gap?.notable && (
          <span className="shift-acceptance__gap" data-testid="shift-acceptance-gap">
            {fmt(t("shift.acceptCount.gap"), venueSpan(count.gap.from, null), venueSpan(count.gap.to, null))}
          </span>
        )}
        {hasShortage && count.blamed_user && (
          <span data-testid="shift-acceptance-blamed">{fmt(t("shift.acceptCount.blamed"), count.blamed_user.name)}</span>
        )}
        <span className="muted shift-acceptance__rule">{t("shift.acceptCount.flowRule")}</span>
      </div>

      {shortages.length > 0 && (
        <ul className="shift-acceptance__reasons" data-testid="shift-stock-reasons">
          {shortages.map((r) => (
            <li key={r.product_id ?? r.name} data-testid="shift-stock-reason">
              {fmt(t("shift.handover.reason"), r.name, -r.diff, m(r.value), r.expected, r.counted)}
            </li>
          ))}
        </ul>
      )}

      <div className="shift-acceptance__box">
        <table className="shift-acceptance__table is-full">
          <thead>
            <tr>
              <th scope="col">{t("shift.acceptCount.product")}</th>
              {head.map(([k, text]) => <th key={k} scope="col">{text}</th>)}
            </tr>
          </thead>
          <tbody>
            {count.rows.map((r) => (
              <FullRow key={r.product_id ?? r.name} row={r} countedAt={count.counted_at} showCorrected={showCorrected} label={label} m={m} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="shift-acceptance__totals" data-testid="shift-acceptance-totals">
        {hasShortage && (
          <strong className="is-shortage" data-testid="shift-acceptance-total-shortage">
            ⚠ {fmt(t("shift.acceptCount.totalShortage"), m(totals.shortage_value))}
          </strong>
        )}
        {hasSurplus && (
          <strong data-testid="shift-acceptance-total-surplus">{fmt(t("shift.acceptCount.totalSurplus"), m(totals.surplus_value))}</strong>
        )}
        {!hasShortage && !hasSurplus && totals.baseline_products < totals.products && (
          <span className="muted">{t("shift.acceptCount.allMatch")}</span>
        )}
      </div>
    </Section>
  );
};

const FullRow = ({ row: r, countedAt, showCorrected, label, m }: {
  row: IAcceptanceCountRow;
  countedAt: string | null;
  showCorrected: boolean;
  label: (key: string) => string;
  m: (amount: string) => string;
}) => {
  const { t } = useLang();
  const shortage = r.outcome === STOCK_COUNT_OUTCOME.shortage;
  const surplus = r.outcome === STOCK_COUNT_OUTCOME.surplus;
  const baseline = r.outcome === STOCK_COUNT_OUTCOME.baseline;
  const f = r.flow ?? null;
  const unknown = "-";

  return (
    <tr className={shortage ? "is-shortage" : undefined} data-testid="shift-acceptance-row" data-outcome={r.outcome}>
      <th scope="row">
        <span className="shift-acceptance__name">{r.name}</span>
        <span className={`shift-acceptance__outcome${shortage ? " is-shortage" : ""}`} data-testid="shift-acceptance-outcome">
          {shortage ? "⚠ " : ""}{t(`shift.acceptCount.outcome.${r.outcome}`)}
        </span>
        {shortage && r.last_sale_at && (
          <span className="muted shift-acceptance__sale" data-testid="shift-acceptance-last-sale">
            {fmt(t("shift.acceptCount.lastSale"), venueMoment(r.last_sale_at, countedAt))}
          </span>
        )}
      </th>
      <td data-label={label("accepted")} data-col="accepted">
        {f === null ? unknown : f.accepted === null ? <span className="muted">{t("shift.acceptCount.noPreviousCount")}</span> : f.accepted}
      </td>
      <td data-label={label("received")} data-col="received">{f === null ? unknown : f.received}</td>
      <td data-label={label("sold")} data-col="sold">{f === null ? unknown : f.sold}</td>
      <td data-label={label("returned")} data-col="returned">{f === null ? unknown : f.returned}</td>
      {showCorrected && (
        <td data-label={label("corrected")} data-col="corrected">{f === null ? unknown : signedDelta(f.corrected)}</td>
      )}
      <td data-label={label("expected")} data-col="expected">{r.expected}</td>
      <td data-label={label("counted")} data-col="counted"><strong>{r.counted}</strong></td>
      <td data-label={label("diff")} data-col="diff" className={shortage ? "is-shortage" : undefined}>
        {/* A first count is compared with nothing: no difference is claimed. */}
        {baseline ? unknown : signedDelta(r.diff)}
      </td>
      <td data-label={label("value")} data-col="value" className={shortage ? "is-shortage" : undefined}>
        {shortage || surplus ? m(r.value) : unknown}
      </td>
    </tr>
  );
};

export default ShiftAcceptanceBlock;
