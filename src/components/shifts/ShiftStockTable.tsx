import { signedDelta, stockNumber } from "@/components/products/stock";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import type { IShiftStock } from "@/types/shifts";
import { Section } from "./shiftReportParts";

/**
 * «Остатки» (report v6, 2026-11-16): for each counted product, what the shift
 * started with, received, sold, took back, recounted, and what is left — in
 * pieces, never money, with the server's totals in the last row. Nothing is
 * added up here. Below zero is red and named under the table: those are the
 * products to recount. A report from before v6, or a branch that counts
 * nothing, shows no table.
 *
 * The table scrolls sideways in its own viewport (`.hs-scroll`, the history
 * timeline's) when the window is narrow; the page never does.
 */
const ShiftStockTable = ({ stock }: { stock: IShiftStock }) => {
  const { t } = useLang();
  if (stock.rows.length === 0) return null;

  const count = (v: number | null) => (v === null ? t("shift.stock.notCounted") : stockNumber(v));
  const negative = stock.rows.filter((r) => r.remaining !== null && r.remaining < 0);
  const head = ["start", "received", "sold", "returned", "corrected", "remaining"] as const;

  return (
    <Section title={t("shift.stock")} testId="shift-stock">
      <span className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("shift.stockRule")}</span>
      <div className="hs-scroll shift-stock__scroll" role="region" aria-label={t("shift.stock")} tabIndex={0}>
        <table className="shift-stock">
          <thead>
            <tr>
              <th scope="col">{t("shift.stock.product")}</th>
              {head.map((k) => <th key={k} scope="col">{t(`shift.stock.${k}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {stock.rows.map((r) => (
              <tr key={r.product_id ?? r.name} data-testid="shift-stock-row">
                <th scope="row" title={r.name}>{r.name}</th>
                <td>{count(r.start)}</td>
                <td>{r.received}</td>
                <td>{r.sold}</td>
                <td>{r.returned}</td>
                <td>{r.corrected === 0 ? "0" : signedDelta(r.corrected)}</td>
                <td className={r.remaining !== null && r.remaining < 0 ? "is-negative" : undefined} data-testid="shift-stock-remaining">
                  {count(r.remaining)}
                </td>
              </tr>
            ))}
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
      {negative.length > 0 && (
        <span className="shift-stock__negative" role="status" data-testid="shift-stock-negative">
          {fmt(t("shift.stock.negative"), negative.map((r) => `${r.name} ${stockNumber(r.remaining as number)}`).join(", "))}
        </span>
      )}
    </Section>
  );
};

export default ShiftStockTable;
