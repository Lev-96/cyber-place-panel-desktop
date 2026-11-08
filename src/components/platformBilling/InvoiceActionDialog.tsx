import { apiAdjustInvoice, apiExtendInvoice, apiRecordPayment } from "@/api/platformBilling";
import { formatApiError } from "@/api/errors";
import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Input from "@/components/ui/Input";
import MaskedDateInput from "@/components/ui/MaskedDateInput";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { renderText, textKey, textLiteral, type LocalizedText } from "@/i18n/localizedText";
import { fmt } from "@/i18n/translations";
import { PAYMENT_METHODS, type IPlatformInvoiceSummary } from "@/types/platformBilling";
import { FormEvent, useId, useState } from "react";
import { formatBillingDate, periodText, useBillingMoney } from "./billingFormat";
import {
  NOTE_MAX, REASON_MAX, REFERENCE_MAX, validateAdjustment, validateExtend, validatePayment, venueToday,
  type ActionKind,
} from "./invoiceActions";

interface Props {
  kind: ActionKind;
  invoice: IPlatformInvoiceSummary;
  onClose: () => void;
  /** The write went through; the caller re-reads the invoice and the list. */
  onDone: () => void;
}

const TITLE: Record<ActionKind, string> = {
  payment: "platformBilling.admin.recordPayment",
  adjustment: "platformBilling.admin.adjust",
  extend: "platformBilling.admin.extend",
};

/**
 * One admin write on an invoice: record a payment, an adjustment, or a later
 * due date. Fill in → checked here → the app's confirm dialog names exactly
 * what will happen → sent. The server's refusal (validation, a locked
 * invoice, a duplicate reference) is shown in the dialog as it came.
 */
const InvoiceActionDialog = ({ kind, invoice, onClose, onDone }: Props) => {
  const { t } = useLang();
  const money = useBillingMoney();
  const confirm = useConfirm();
  const formId = useId();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [newDueOn, setNewDueOn] = useState("");
  const [error, setError] = useState<LocalizedText | null>(null);
  const [busy, setBusy] = useState(false);

  // The Input primitive's label is a sibling span, so the field is named
  // explicitly for assistive tech.
  const amountLabel = fmt(t(kind === "payment" ? "platformBilling.admin.amount" : "platformBilling.admin.signedAmount"), invoice.currency);
  const who = `${invoice.company_name ?? `№${invoice.company_id}`} (${periodText(invoice.period_start, invoice.period_end)})`;

  /** What is wrong with the form, or the question to ask and the request to send. */
  const plan = (): { errorKey: string } | { question: string; send: () => Promise<unknown> } => {
    if (kind === "payment") {
      const v = validatePayment({ amount, method, reference, note });
      if (!v.ok) return { errorKey: v.errorKey };
      return {
        question: fmt(t("platformBilling.admin.confirmPayment"), money(v.payload.amount, invoice.currency), who),
        send: () => apiRecordPayment(invoice.id, v.payload),
      };
    }
    if (kind === "adjustment") {
      const v = validateAdjustment({ amount, reason });
      if (!v.ok) return { errorKey: v.errorKey };
      return {
        question: fmt(t("platformBilling.admin.confirmAdjust"), money(v.payload.amount, invoice.currency), who),
        send: () => apiAdjustInvoice(invoice.id, v.payload),
      };
    }
    const v = validateExtend({ newDueOn, reason }, venueToday());
    if (!v.ok) return { errorKey: v.errorKey };
    return {
      question: fmt(t("platformBilling.admin.confirmExtend"), formatBillingDate(v.payload.new_due_on), who),
      send: () => apiExtendInvoice(invoice.id, v.payload),
    };
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const next = plan();
    if ("errorKey" in next) { setError(textKey(next.errorKey)); return; }
    if (!(await confirm(next.question, { confirmLabel: t(TITLE[kind]) }))) return;

    setBusy(true);
    try {
      await next.send();
      onDone();
    } catch (err) {
      // The server's own sentence (validation, a duplicate reference, a
      // locked invoice): it is in the language the request was made in.
      setError(textLiteral(formatApiError(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose}>
      <form className="card billing-action" onSubmit={(e) => void submit(e)} aria-labelledby={`${formId}-title`} noValidate>
        <h2 id={`${formId}-title`} className="billing-action__title">{t(TITLE[kind])}</h2>
        <p className="muted billing-action__who">{who}</p>

        {kind !== "extend" && (
          <Input
            label={amountLabel}
            aria-label={amountLabel}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            required
          />
        )}

        {kind === "payment" && (
          <>
            <label className="billing-action__field">
              <span className="label">{t("platformBilling.admin.method")}</span>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{t(`platformBilling.method.${m}`)}</option>
                ))}
              </select>
            </label>
            <Input label={t("platformBilling.admin.reference")} aria-label={t("platformBilling.admin.reference")} value={reference} maxLength={REFERENCE_MAX} onChange={(e) => setReference(e.target.value)} />
            <Input label={t("platformBilling.admin.note")} aria-label={t("platformBilling.admin.note")} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
          </>
        )}

        {kind === "extend" && (
          <MaskedDateInput label={t("platformBilling.admin.newDueDate")} valueIso={newDueOn} onChangeIso={setNewDueOn} required autoFocus />
        )}

        {kind !== "payment" && (
          <label className="billing-action__field">
            <span className="label">{t("platformBilling.admin.reason")}</span>
            <textarea className="input billing-action__reason" value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} required />
          </label>
        )}

        {error && <div className="error" role="alert">{renderText(error, t)}</div>}

        <div className="billing-action__buttons">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button type="submit" disabled={busy}>{t(TITLE[kind])}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default InvoiceActionDialog;
