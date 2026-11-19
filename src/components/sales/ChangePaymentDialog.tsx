import type { ISalesLine } from "@/api/salesSummary";
import PaymentEditor from "@/components/payments/PaymentEditor";
import { PAYMENT_PROBLEM_KEY, checkPayment, emptyPaymentDraft, paymentBody, type PaymentDraft } from "@/components/payments/paymentSplit";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { sessionRepository } from "@/repositories/SessionRepository";
import { notify } from "@/ui/notify";
import { useState } from "react";
import { whereLine } from "./salesSummaryModel";

interface Props {
  branchId: number;
  line: ISalesLine;
  onClose: () => void;
  /** After the server changed it: the lists and the cards are read again. */
  onChanged: () => void;
}

/** Shown on a place's line that has money and was not paid ahead; the server decides the rest. */
export const canChangePayment = (l: ISalesLine): boolean =>
  l.kind === "place" && !l.is_free && Number(l.amount) > 0 && !(Number(l.prepaid ?? 0) > 0);

/**
 * «Изменить способ оплаты» (2026-11-19, owner: a seat that ended by itself was
 * banked as cash, the player paid by card). The same payment control as Stop;
 * the SAME total — only how it was paid changes. The server refuses what it
 * will not do (its shift closed, its working day over, paid ahead) with its
 * own sentence; nothing is computed here but the split adding up.
 */
const ChangePaymentDialog = ({ branchId, line, onClose, onChanged }: Props) => {
  const { t, money } = useLang();
  const dueCents = Math.round(Number(line.amount) * 100);
  const [pay, setPay] = useState<PaymentDraft>(() => emptyPaymentDraft("card"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const check = checkPayment(dueCents, pay);
  const problem = check.ok || check.problem === null ? null : t(PAYMENT_PROBLEM_KEY[check.problem]);

  const save = async () => {
    if (!check.ok || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await sessionRepository.changePayment(line.id, paymentBody(pay, check));
      notify.message("success", t("sales.changePayment.done"));
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose}>
      <div className="card col" role="dialog" aria-modal="true" style={{ gap: 12, maxWidth: 520 }} data-testid="change-payment-dialog">
        <h3 style={{ margin: 0 }}>{t("sales.changePayment")}</h3>
        <span className="muted" data-testid="change-payment-what">
          {fmt(t("sales.changePayment.what"), whereLine(line, t), money(Number(line.amount)))}
        </span>
        <PaymentEditor
          name={`change-pay-${line.id}`}
          branchId={branchId}
          dueCents={dueCents}
          value={pay}
          onChange={(next) => { setPay(next); setErr(null); }}
          check={check}
          money={money}
          disabled={busy}
        />
        {problem && <span className="muted" data-testid="change-payment-problem">{problem}</span>}
        {err && <div className="error" role="alert" data-testid="change-payment-error">{err}</div>}
        <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button onClick={() => void save()} disabled={!check.ok || busy} data-testid="change-payment-save">
            {t("sales.changePayment.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ChangePaymentDialog;
