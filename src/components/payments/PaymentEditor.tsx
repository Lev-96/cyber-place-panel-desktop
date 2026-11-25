import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { apiPaymentLabels } from "@/api/paymentLabels";
import { useEffect, useState } from "react";
import BonusUseAll from "./BonusUseAll";
import { PAYMENT_METHODS } from "./PaymentMethodPicker";
import {
  OWN_LABEL_MAX, SPLIT_METHODS, addOwnPart, duplicateOwnIds, fillRemaining, hasOwnLabel, ownLabel,
  OWN_PARTS_MAX, type BillMethod, type OwnPart, type PaymentCheck, type PaymentDraft,
} from "./paymentSplit";

/** A method's full name: the tooltip, the accessible name, the hidden field label. */
const LABEL_KEY: Record<BillMethod, string> = {
  cash: "session.payCash",
  card: "session.payCard",
  other: "session.payOther",
  bonus: "pay.bonus",
};

/**
 * What a method's button SHOWS (2026-11-08, owner): one short word, so all
 * four buttons stay one line and one height. «Другой способ оплаты» broke
 * onto three lines and out of its box; the full name stays on hover.
 */
const SHORT_KEY: Record<BillMethod, string> = {
  cash: "session.payCash",
  card: "session.payCard",
  other: "pay.otherShort",
  bonus: "pay.bonus",
};

interface Props {
  /** The branch the bill is in: its saved «Свой вариант» names are offered (2026-11-18). */
  branchId?: number;
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
  /**
   * A Club Card bound to this bill (2026-11-25): «Бонусы» is offered, as one
   * method or a part of a split, and «Использовать все бонусы». Absent: the
   * editor is exactly as before.
   */
  bonus?: { balanceCents: number };
}

/**
 * How the bill was paid (2026-11-07, owner) — the one control for every
 * screen that closes a bill. Cash / Card / Other, as it always was, or
 * «Разделить»: a box per method, what is still due live under them, a «the
 * rest here» button per box, and a note saying how it was paid (optional
 * since 2026-11-15, owner — "3000 картой, 2000 наличными"; so is the
 * «Другое» text). The parts must add up to the bill to the cent; the confirm
 * waits for it. One part above zero is sent as that single method.
 */
const PaymentEditor = ({ name, dueCents, value, onChange, check, money, disabled = false, branchId, bonus }: Props) => {
  const { t } = useLang();
  const pick = (method: BillMethod) => onChange({ ...value, split: false, method });
  const methods: BillMethod[] = bonus ? [...PAYMENT_METHODS, "bonus"] : [...PAYMENT_METHODS];
  /**
   * The names this branch has already paid with (2026-11-18, owner: a
   * created option is kept, nobody types it again): one press each. Read when
   * a split is opened; a failed read just offers none.
   */
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    if (!value.split || branchId === undefined) return;
    let alive = true;
    apiPaymentLabels(branchId)
      .then(({ data }) => { if (alive) setSaved(data.map((l) => l.label)); })
      .catch(() => { if (alive) setSaved([]); });
    return () => { alive = false; };
  }, [value.split, branchId]);
  // A saved name already in a row is not offered again: names are distinct.
  const offered = saved.filter((label) => !hasOwnLabel(value, label));
  // Several «Свой вариант» rows (2026-11-19, owner): a repeated name, or a
  // second row without one, is refused on that row in plain words.
  const duplicates = duplicateOwnIds(value.own);
  const setOwn = (id: number, patch: Partial<Omit<OwnPart, "id">>) =>
    onChange({ ...value, own: value.own.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const removeOwn = (id: number) => onChange({ ...value, own: value.own.filter((p) => p.id !== id) });

  return (
    <div className="col pay-editor" style={{ gap: 8 }} data-testid="payment-editor">
      <strong style={{ fontSize: 13 }}>{t("session.payTitle")}</strong>
      <div className="pay-editor__methods" role="radiogroup" aria-label={t("session.payTitle")}>
        {methods.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            name={name}
            aria-checked={!value.split && value.method === m}
            className="pay-editor__method"
            disabled={disabled || (m === "bonus" && (bonus?.balanceCents ?? 0) < dueCents)}
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

      {bonus && <BonusUseAll balanceCents={bonus.balanceCents} dueCents={dueCents} value={value} onChange={onChange} disabled={disabled} />}

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
          {bonus && (
            <div className="pay-editor__part" data-testid="pay-bonus-row">
              <span className="pay-editor__part-name" title={t(LABEL_KEY.bonus)}>{t(SHORT_KEY.bonus)}</span>
              <div className="pay-editor__part-box">
                <PriceInput label={t(LABEL_KEY.bonus)} value={value.bonus} onChange={(v) => onChange({ ...value, bonus: v })} disabled={disabled} />
              </div>
              <Button type="button" variant="secondary" className="pay-editor__rest"
                disabled={disabled || check.remainingCents <= 0} onClick={() => onChange(fillRemaining(dueCents, value, "bonus"))} data-testid="pay-rest-bonus">
                {t("pay.restHere")}
              </Button>
            </div>
          )}
          {value.own.map((part) => {
            const duplicate = duplicates.has(part.id);
            return (
              <div key={part.id} className="col pay-editor__own" data-testid="pay-own-row">
                <div className="pay-editor__part">
                  {/* «Свой вариант» (2026-11-18, owner): its name on the left —
                      Idram, Telcell, «Hovo Card»; the sales history totals by it. */}
                  <input
                    className={`input pay-editor__own-name${duplicate ? " is-invalid" : ""}`}
                    value={part.label}
                    maxLength={OWN_LABEL_MAX}
                    placeholder={t("pay.ownNamePlaceholder")}
                    aria-label={t("pay.ownName")}
                    aria-invalid={duplicate || undefined}
                    onChange={(e) => setOwn(part.id, { label: e.target.value })}
                    disabled={disabled}
                    data-testid="pay-own-name"
                  />
                  <div className="pay-editor__part-box">
                    <PriceInput
                      label={ownLabel(part) || t("session.payOther")}
                      value={part.amount}
                      onChange={(v) => setOwn(part.id, { amount: v })}
                      disabled={disabled}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="pay-editor__rest"
                    disabled={disabled || check.remainingCents <= 0}
                    onClick={() => onChange(fillRemaining(dueCents, value, { own: part.id }))}
                    data-testid="pay-rest-other"
                  >
                    {t("pay.restHere")}
                  </Button>
                  <button
                    type="button"
                    className="pay-editor__own-remove"
                    aria-label={t("pay.ownRemove")}
                    title={t("pay.ownRemove")}
                    disabled={disabled}
                    onClick={() => removeOwn(part.id)}
                    data-testid="pay-own-remove"
                  >
                    ×
                  </button>
                </div>
                {duplicate && (
                  <div className="pay-editor__own-error" role="alert" data-testid="pay-own-duplicate">
                    {ownLabel(part) === "" ? t("pay.ownUnnamedTwice") : t("pay.ownDuplicate")}
                  </div>
                )}
              </div>
            );
          })}
          {value.own.length < OWN_PARTS_MAX && (
          <div className="row pay-editor__own-choices">
            {offered.map((label) => (
              <Button
                key={label}
                type="button"
                variant="secondary"
                className="pay-editor__own-saved"
                disabled={disabled}
                onClick={() => onChange(addOwnPart(value, label))}
                data-testid={`pay-own-saved-${label}`}
              >
                {`+ ${label}`}
              </Button>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="pay-editor__own-add"
              disabled={disabled}
              onClick={() => onChange(addOwnPart(value))}
              data-testid="pay-own-add"
            >
              {t("pay.ownAdd")}
            </Button>
          </div>
          )}
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
            <span className="label">{t("pay.note")}</span>
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
        </div>
      )}
    </div>
  );
};

export default PaymentEditor;
