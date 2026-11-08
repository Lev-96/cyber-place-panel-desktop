import type { PaymentMethod } from "@/api/sessions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { PAYMENT_METHODS } from "./PaymentMethodPicker";
import { SPLIT_METHODS, fillRemaining, type PaymentCheck, type PaymentDraft } from "./paymentSplit";

/** A method's full name: the tooltip, the accessible name, the hidden field label. */
const LABEL_KEY: Record<PaymentMethod, string> = {
  cash: "session.payCash",
  card: "session.payCard",
  other: "session.payOther",
};

/**
 * What a method's button SHOWS (2026-11-08, owner): one short word, so all
 * four buttons stay one line and one height. «Другой способ оплаты» broke
 * onto three lines and out of its box; the full name stays on hover.
 */
const SHORT_KEY: Record<PaymentMethod, string> = {
  cash: "session.payCash",
  card: "session.payCard",
  other: "pay.otherShort",
};

interface Props {
  /** The radio group's name: unique per open form. */
  name: string;
  /** The bill, in cents (the server's total). */
  dueCents: number;
  value: PaymentDraft;
  onChange: (next: PaymentDraft) => void;
  /** `checkPayment(dueCents, value)`, computed once by the caller (it also gates the confirm). */
  check: PaymentCheck;
  money: (amount: number) => string;
  disabled?: boolean;
}

/**
 * How the bill was paid (2026-11-07, owner) — the one control for every
 * screen that closes a bill. Cash / Card / Other, as it always was, or
 * «Разделить»: a box per method, what is still due live under them, a «the
 * rest here» button per box, and a note saying how it was paid (required —
 * "3000 картой, 2000 наличными"). The parts must add up to the bill to the
 * cent; the confirm waits for it.
 */
const PaymentEditor = ({ name, dueCents, value, onChange, check, money, disabled = false }: Props) => {
  const { t } = useLang();
  const pick = (method: PaymentMethod) => onChange({ ...value, split: false, method });

  return (
    <div className="col pay-editor" style={{ gap: 8 }} data-testid="payment-editor">
      <strong style={{ fontSize: 13 }}>{t("session.payTitle")}</strong>
      <div className="pay-editor__methods" role="radiogroup" aria-label={t("session.payTitle")}>
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            name={name}
            aria-checked={!value.split && value.method === m}
            className="pay-editor__method"
            disabled={disabled}
            onClick={() => pick(m)}
            data-testid={`pay-${m}`}
            title={t(LABEL_KEY[m])}
            aria-label={t(LABEL_KEY[m])}
          >
            {t(SHORT_KEY[m])}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={value.split}
          className="pay-editor__method"
          disabled={disabled}
          onClick={() => onChange({ ...value, split: true })}
          data-testid="pay-split"
        >
          {t("pay.split")}
        </button>
      </div>

      {!value.split && value.method === "other" && (
        <Input
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder={t("session.payOtherPlaceholder")}
          disabled={disabled}
          aria-label={t("session.payOther")}
        />
      )}

      {value.split && (
        <div className="col pay-editor__split" style={{ gap: 8 }}>
          {SPLIT_METHODS.map((m) => (
            <div key={m} className="pay-editor__part">
              <span className="pay-editor__part-name" title={t(LABEL_KEY[m])}>{t(SHORT_KEY[m])}</span>
              <div className="pay-editor__part-box">
                <PriceInput
                  label={t(LABEL_KEY[m])}
                  value={value.amounts[m]}
                  onChange={(v) => onChange({ ...value, amounts: { ...value.amounts, [m]: v } })}
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="pay-editor__rest"
                disabled={disabled || check.remainingCents <= 0}
                onClick={() => onChange(fillRemaining(dueCents, value, m))}
                data-testid={`pay-rest-${m}`}
              >
                {t("pay.restHere")}
              </Button>
            </div>
          ))}
          <div
            className={`pay-editor__remaining${check.remainingCents === 0 ? " is-done" : ""}`}
            data-testid="pay-remaining"
            aria-live="polite"
          >
            {check.problem === "invalid"
              ? t("pay.invalid")
              : check.remainingCents === 0
                ? t("pay.allPaid")
                : check.remainingCents > 0
                  ? fmt(t("pay.remaining"), money(check.remainingCents / 100))
                  : fmt(t("pay.tooMuch"), money(-check.remainingCents / 100))}
          </div>
          <label className="col" style={{ gap: 4 }}>
            <span className="label">{t("pay.note")} *</span>
            <textarea
              className="input pay-editor__note"
              rows={2}
              maxLength={255}
              value={value.note}
              onChange={(e) => onChange({ ...value, note: e.target.value })}
              placeholder={t("pay.notePlaceholder")}
              disabled={disabled}
              aria-label={t("pay.note")}
              data-testid="pay-note"
            />
          </label>
          {check.problem === "parts" && <span className="muted" style={{ fontSize: 12 }}>{t("pay.needTwo")}</span>}
        </div>
      )}
    </div>
  );
};

export default PaymentEditor;
