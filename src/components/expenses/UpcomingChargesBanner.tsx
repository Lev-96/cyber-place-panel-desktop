import { IServiceExpense } from "@/api/expenses";
import { dueLabel } from "@/components/expenses/expenseFormat";
import Button from "@/components/ui/Button";
import { formatDate } from "@/i18n/dates";
import { formatAmount } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  items: IServiceExpense[];
  onMarkPaid: (e: IServiceExpense) => void;
  busyId?: number | null;
}

/**
 * The on-demand "remind me 3 days before" surface: services charging
 * within the reminder window (or already overdue), with names, amounts and
 * a one-tap "paid" action right where the admin is reminded. Renders
 * nothing when there is nothing due.
 */
const UpcomingChargesBanner = ({ items, onMarkPaid, busyId }: Props) => {
  const { t, lang } = useLang();
  if (items.length === 0) return null;

  return (
    <div className="card" style={{ borderLeft: "4px solid #f59e0b", marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
        ⚠️ {t("expenses.upcomingTitle")}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((e) => (
          <div key={e.id} className="row-between" style={{ fontSize: 14, gap: 10 }}>
            <span>
              <span style={{ fontWeight: 600 }}>{e.name}</span>
              <span className="muted">
                {" · "}{dueLabel(e.days_until_due, t)}{" · "}{formatDate(e.next_due_at)}
              </span>
            </span>
            <span className="row" style={{ gap: 10, alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>{formatAmount(e.amount, e.currency, lang)}</span>
              <Button
                onClick={() => onMarkPaid(e)}
                disabled={busyId === e.id}
                style={{ padding: "4px 10px", fontSize: 12 }}
              >
                {t("expenses.markPaid")}
              </Button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingChargesBanner;
