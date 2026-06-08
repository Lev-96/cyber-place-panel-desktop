import { IServiceExpense } from "@/api/expenses";
import { dueLabel } from "@/components/expenses/expenseFormat";
import { formatDate } from "@/i18n/dates";
import { formatAmount } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";

/**
 * The on-demand "remind me 3 days before" surface: services charging
 * within the reminder window, with their names and amounts. Renders
 * nothing when there is nothing due soon.
 */
const UpcomingChargesBanner = ({ items }: { items: IServiceExpense[] }) => {
  const { t, lang } = useLang();
  if (items.length === 0) return null;

  return (
    <div className="card" style={{ borderLeft: "4px solid #f59e0b", marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
        ⚠️ {t("expenses.upcomingTitle")}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {items.map((e) => (
          <div key={e.id} className="row-between" style={{ fontSize: 14 }}>
            <span>
              <span style={{ fontWeight: 600 }}>{e.name}</span>
              <span className="muted">
                {" · "}{dueLabel(e.days_until_due, t)}{" · "}{formatDate(e.next_due_at)}
              </span>
            </span>
            <span style={{ fontWeight: 700 }}>{formatAmount(e.amount, e.currency, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingChargesBanner;
