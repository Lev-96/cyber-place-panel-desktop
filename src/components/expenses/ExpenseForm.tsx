import { IServiceExpense } from "@/api/expenses";
import { friendlyMutation } from "@/api/fallback";
import { formatApiError } from "@/api/errors";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Currency } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";
import { expenseRepository } from "@/repositories/ExpenseRepository";
import { FormEvent, useState } from "react";

interface Props {
  initial?: IServiceExpense;
  onClose: () => void;
  onSaved: () => void;
}

const CURRENCIES: Currency[] = ["USD", "AMD", "RUB"];

/** Local "YYYY-MM-DD" for today — the default purchase date. */
const todayIso = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const ExpenseForm = ({ initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState<string>(initial != null ? String(initial.amount) : "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [purchasedAt, setPurchasedAt] = useState<string>(initial?.purchased_at ?? todayIso());
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount.replace(",", "."));
    if (!name.trim() || !Number.isFinite(amountNum) || amountNum < 0 || !purchasedAt) {
      setErr(t("expenses.invalidForm"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const body = {
        name: name.trim(),
        amount: amountNum,
        currency,
        purchased_at: purchasedAt,
        is_active: isActive,
      };
      if (initial) await friendlyMutation(expenseRepository.update(initial.id, body));
      else await friendlyMutation(expenseRepository.create(body));
      onSaved();
    } catch (e) {
      setErr(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <form
        className="card"
        style={{ width: 440, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 12 }}
        onSubmit={submit}
      >
        <h2 style={{ margin: 0 }}>{initial ? t("expenses.edit") : t("expenses.new")}</h2>

        <Input
          label={t("expenses.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("expenses.namePlaceholder")}
          required
          maxLength={120}
          autoFocus
        />

        <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Input
              label={t("expenses.amount")}
              inputMode="decimal"
              placeholder="12"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <span className="label">{t("expenses.currency")}</span>
            <select
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label={t("expenses.purchasedAt")}
          type="date"
          value={purchasedAt}
          onChange={(e) => setPurchasedAt(e.target.value)}
          required
        />

        <label className="row" style={{ gap: 8, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>{t("expenses.isActive")}</span>
        </label>

        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t("action.cancel")}
          </Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ExpenseForm;
