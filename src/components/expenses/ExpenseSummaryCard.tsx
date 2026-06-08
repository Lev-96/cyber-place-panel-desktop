import { IServiceExpense } from "@/api/expenses";
import { Currency, formatAmount, moneyDisplay } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";

/**
 * Monthly total for the active services: a per-currency subtotal (literal
 * amounts, never silently merged) plus one grand total rolled into the
 * admin's display currency via the live FX rates.
 */
const ExpenseSummaryCard = ({ active }: { active: IServiceExpense[] }) => {
  const { t, lang, money } = useLang();

  const subtotals = active.reduce<Partial<Record<Currency, number>>>((acc, e) => {
    acc[e.currency] = (acc[e.currency] ?? 0) + e.amount;
    return acc;
  }, {});
  const grandTotalAmd = active.reduce(
    (sum, e) => sum + moneyDisplay.convertBetween(e.amount, e.currency, "AMD"),
    0,
  );

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        {t("expenses.monthlyTotal")}
      </div>
      {active.length === 0 ? (
        <div className="muted">{t("expenses.empty")}</div>
      ) : (
        <>
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            {(Object.keys(subtotals) as Currency[]).map((c) => (
              <span key={c} style={{ fontWeight: 700, fontSize: 18 }}>
                {formatAmount(subtotals[c] ?? 0, c, lang)}
              </span>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            ≈ {money(grandTotalAmd)} {t("expenses.perMonth")}
          </div>
        </>
      )}
    </div>
  );
};

export default ExpenseSummaryCard;
