import { IServiceExpense } from "@/api/expenses";
import { orFallback } from "@/api/fallback";
import ExpenseForm from "@/components/expenses/ExpenseForm";
import ExpenseListItem from "@/components/expenses/ExpenseListItem";
import ExpenseSummaryCard from "@/components/expenses/ExpenseSummaryCard";
import { REMIND_WITHIN_DAYS } from "@/components/expenses/expenseFormat";
import UpcomingChargesBanner from "@/components/expenses/UpcomingChargesBanner";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { expenseRepository } from "@/repositories/ExpenseRepository";
import { useState } from "react";

const Expenses = () => {
  const { t } = useLang();
  const { data, loading, error, reload } = useAsync(
    () => orFallback(expenseRepository.list(), [] as IServiceExpense[]),
    [],
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IServiceExpense | null>(null);
  const [toDelete, setToDelete] = useState<IServiceExpense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);

  const all = data ?? [];
  const active = all.filter((e) => e.is_active);
  // Due within the reminder window OR already overdue (negative days).
  const upcoming = active
    .filter((e) => e.days_until_due <= REMIND_WITHIN_DAYS)
    .sort((a, b) => a.days_until_due - b.days_until_due);

  const markPaid = async (e: IServiceExpense) => {
    setPayingId(e.id);
    try {
      await expenseRepository.markPaid(e.id);
      void reload();
    } finally {
      setPayingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await expenseRepository.remove(toDelete.id);
      setToDelete(null);
      void reload();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title={t("expenses.title")}>
      <div className="row-between">
        <span className="muted">{t("expenses.subtitle")}</span>
        <Button onClick={() => setCreating(true)}>{t("expenses.new")}</Button>
      </div>

      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}

      {!loading && !error && (
        <>
          <UpcomingChargesBanner items={upcoming} onMarkPaid={markPaid} busyId={payingId} />
          <ExpenseSummaryCard active={active} />

          <div className="list">
            {all.map((e) => (
              <ExpenseListItem
                key={e.id}
                expense={e}
                onEdit={() => setEditing(e)}
                onDelete={() => setToDelete(e)}
                onMarkPaid={() => void markPaid(e)}
                busy={payingId === e.id}
              />
            ))}
            {all.length === 0 && <div className="muted">{t("expenses.empty")}</div>}
          </div>
        </>
      )}

      {creating && (
        <ExpenseForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />
      )}
      {editing && (
        <ExpenseForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
      <ConfirmDialog
        open={toDelete !== null}
        message={`${t("expenses.confirmDelete")} "${toDelete?.name ?? ""}"?`}
        destructive
        confirmLabel={deleting ? "…" : t("action.delete")}
        onConfirm={() => void confirmDelete()}
        onCancel={() => { if (!deleting) setToDelete(null); }}
      />
    </ScreenWithBg>
  );
};

export default Expenses;
