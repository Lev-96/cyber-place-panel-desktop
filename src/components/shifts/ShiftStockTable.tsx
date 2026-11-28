import { signedDelta, stockNumber } from "@/components/products/stock";
import { formatVenueDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { shiftAmount } from "@/shifts/cash";
import {
  type IAcceptanceCount, type IAcceptanceCountRow, type IShiftStock, type IStockHandover,
  STOCK_COUNT_OUTCOME, isBlindCount,
} from "@/types/shifts";
import { Section } from "./shiftReportParts";

/**
 * «Остатки» (report v6, 2026-11-16): for each counted product, what the shift
 * started with, received, sold, took back, recounted, and what is left — in
 * pieces, with the server's totals in the last row. Nothing is added up here.
 * Below zero is red and named under the table: those are the products to
 * recount. A report from before v6, or a branch that counts nothing, shows no
 * table.
 *
 * The minus, where it happened (2026-11-28, owner). A shortage is only found
 * when the NEXT manager counts the shelf at acceptance, and that count resets
 * the shelf — so the minus used to vanish from the shift it belonged to. Now:
 * - `handover` (this shift was handed over; owner / admin only, the server's
 *   `summary.stock_handover`): «Осталось» of a short product reads «9 → 8
 *   (−1)» in red (no extra column: the report sits in a 680px dialog), and
 *   one sentence per shortage under the table;
 * - `acceptance` (the count THIS shift was opened with; full = owner / admin):
 *   the «Пересчёт» of the acceptance is explained as the previous shift's
 *   shortage, so a −1 here is never a mystery.
 * A manager gets neither (the server sends no figures), so nothing changes
 * for them. Every figure is the server's.
 *
 * The table scrolls sideways in its own viewport (`.hs-scroll`, the history
 * timeline's) when the window is narrow; the page never does.
 */
interface Props {
  stock: IShiftStock;
  handover?: IStockHandover | null;
  acceptance?: IAcceptanceCount | null;
}

const isShortage = (r: IAcceptanceCountRow) => r.outcome === STOCK_COUNT_OUTCOME.shortage;

const ShiftStockTable = ({ stock, handover = null, acceptance = null }: Props) => {
  const { t, money } = useLang();
  const m = (amount: string) => shiftAmount(money, amount);
  const handedOver = handover && !isBlindCount(handover) ? handover : null;
  const accepted = acceptance && !isBlindCount(acceptance) ? acceptance : null;
  const nextCount = new Map((handedOver?.rows ?? []).filter((r) => r.product_id !== null).map((r) => [r.product_id as number, r]));
  const lost = (handedOver?.rows ?? []).filter(isShortage);
  const short = (accepted?.rows ?? []).filter(isShortage);
  if (stock.rows.length === 0 && lost.length === 0) return null;

  const count = (v: number | null) => (v === null ? t("shift.stock.notCounted") : stockNumber(v));
  const negative = stock.rows.filter((r) => r.remaining !== null && r.remaining < 0);
  const head = ["start", "received", "sold", "returned", "corrected", "remaining"] as const;

  return (
    <Section title={t("shift.stock")} testId="shift-stock">
      <span className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("shift.stockRule")}</span>
      {stock.rows.length > 0 && (
        <div className="hs-scroll shift-stock__scroll" role="region" aria-label={t("shift.stock")} tabIndex={0}>
          <table className="shift-stock">
            <thead>
              <tr>
                <th scope="col">{t("shift.stock.product")}</th>
                {head.map((k) => <th key={k} scope="col">{t(`shift.stock.${k}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {stock.rows.map((r) => {
                const next = r.product_id === null ? undefined : nextCount.get(r.product_id);
                const minus = next !== undefined && isShortage(next);
                return (
                  <tr key={r.product_id ?? r.name} data-testid="shift-stock-row" className={minus ? "is-short" : undefined}>
                    <th scope="row" title={r.name}>{r.name}</th>
                    <td>{count(r.start)}</td>
                    <td>{r.received}</td>
                    <td>{r.sold}</td>
                    <td>{r.returned}</td>
                    <td>{r.corrected === 0 ? "0" : signedDelta(r.corrected)}</td>
                    <td className={(r.remaining !== null && r.remaining < 0) || minus ? "is-negative" : undefined} data-testid="shift-stock-remaining">
                      {count(r.remaining)}
                      {/* «было → стало»: what the next shift found on the shelf. */}
                      {minus && next && (
                        <span className="shift-stock__found" data-testid="shift-stock-next" title={t("shift.stock.nextCount")}>
                          {` → ${next.counted} (${signedDelta(next.diff)})`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr data-testid="shift-stock-total">
                <th scope="row">{t("shift.stock.total")}</th>
                <td>{stockNumber(stock.totals.start)}</td>
                <td>{stock.totals.received}</td>
                <td>{stock.totals.sold}</td>
                <td>{stock.totals.returned}</td>
                <td>{stock.totals.corrected === 0 ? "0" : signedDelta(stock.totals.corrected)}</td>
                <td className={stock.totals.remaining < 0 ? "is-negative" : undefined}>{stockNumber(stock.totals.remaining)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {negative.length > 0 && (
        <span className="shift-stock__negative" role="status" data-testid="shift-stock-negative">
          {fmt(t("shift.stock.negative"), negative.map((r) => `${r.name} ${stockNumber(r.remaining as number)}`).join(", "))}
        </span>
      )}

      {lost.length > 0 && handedOver && (
        <div className="shift-stock__lost" role="status" data-testid="shift-stock-handover">
          <strong data-testid="shift-stock-handover-total">
            ⚠ {fmt(t("shift.stock.lostTotal"), handedOver.totals.shortage_units, m(handedOver.totals.shortage_value))}
          </strong>
          <span className="muted" data-testid="shift-stock-handover-by">
            {fmt(t("shift.handover.acceptedBy"), handedOver.accepted_by_shift.opened_by?.name ?? "", handedOver.counted_at ? formatVenueDateTime(handedOver.counted_at) : "")}
          </span>
          <ul data-testid="shift-stock-lost-reasons">
            {lost.map((r) => (
              <li key={r.product_id ?? r.name} data-testid="shift-stock-lost-reason">
                {fmt(t("shift.handover.reason"), r.name, -r.diff, m(r.value), r.expected, r.counted)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {short.length > 0 && accepted && (
        <ul className="shift-stock__notes" data-testid="shift-stock-accepted">
          {short.map((r) => (
            <li key={r.product_id ?? r.name} data-testid="shift-stock-accepted-row">
              {fmt(t("shift.stock.acceptedShort"), r.name, signedDelta(r.diff), -r.diff, m(r.value), accepted.blamed_user?.name ?? "")}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

export default ShiftStockTable;
