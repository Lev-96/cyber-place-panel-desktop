import { IServiceExpense } from "@/api/expenses";
import { REMIND_WITHIN_DAYS, dueLabel, dueTone } from "@/components/expenses/expenseFormat";
import Button from "@/components/ui/Button";
import { formatDate } from "@/i18n/dates";
import { formatAmount } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  expense: IServiceExpense;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPaid: () => void;
  busy?: boolean;
}

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

/** One tracked service row — amount in its own currency, next charge, status dot. */
const ExpenseListItem = ({ expense: e, onEdit, onDelete, onMarkPaid, busy }: Props) => {
  const { t, lang } = useLang();

  // "Paid" is locked by default and only unlocks once the charge is
  // within the 3-day reminder window (or already overdue) — the admin
  // settles a month as it comes due, not arbitrarily far in advance.
  const payable = e.days_until_due <= REMIND_WITHIN_DAYS;

  return (
    <div className="list-item" style={{ opacity: e.is_active ? 1 : 0.55 }}>
      <div className="row" style={{ gap: 12, flex: 1, alignItems: "center" }}>
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            flexShrink: 0,
            background: e.is_active ? dueTone(e.days_until_due) : "#4b5563",
          }}
        />
        <div style={{ flex: 1 }}>
          <div className="name">
            {e.name}
            {!e.is_active && <span className="muted"> · {t("expenses.paused")}</span>}
          </div>
          <div className="meta">
            {formatAmount(e.amount, e.currency, lang)} · {t("expenses.nextDue")}: {formatDate(e.next_due_at)}
            {e.is_active && <>{" · "}{dueLabel(e.days_until_due, t)}</>}
            {e.last_paid_at && <>{" · "}{t("expenses.lastPaid")}: {formatDate(e.last_paid_at)}</>}
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {e.is_active && (
          <Button
            onClick={onMarkPaid}
            disabled={busy || !payable}
            style={btn}
            title={!payable ? t("expenses.payLockedHint") : undefined}
          >
            {t("expenses.markPaid")}
          </Button>
        )}
        <Button variant="secondary" onClick={onEdit} style={btn}>{t("action.edit")}</Button>
        <Button
          variant="secondary"
          onClick={onDelete}
          style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}
        >
          {t("action.delete")}
        </Button>
      </div>
    </div>
  );
};

export default ExpenseListItem;
