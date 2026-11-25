import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { useState } from "react";
import { useAllBonuses, type PaymentDraft } from "./paymentSplit";

interface Props {
  balanceCents: number;
  dueCents: number;
  value: PaymentDraft;
  onChange: (next: PaymentDraft) => void;
  money: (amount: number) => string;
  disabled?: boolean;
}

/**
 * The card's balance and «Использовать все бонусы» (2026-11-25, owner): asked
 * once in a confirmation, never more than the bill; too few bonuses → the
 * rest is put on cash and the shortfall is said, so the cashier takes it
 * another way. Drawn only where a card is bound (PaymentEditor's `bonus`).
 */
const BonusUseAll = ({ balanceCents, dueCents, value, onChange, money, disabled }: Props) => {
  const { t } = useLang();
  const confirm = useConfirm();
  const [shortCents, setShortCents] = useState(0);

  const useAll = async () => {
    const spend = Math.min(balanceCents, dueCents);
    const ok = await confirm(fmt(t("pay.bonusUseAllConfirm"), money(spend / 100)), { confirmLabel: t("pay.bonusUseAll") });
    if (!ok) return;
    const { draft, shortCents: short } = useAllBonuses(dueCents, value, balanceCents);
    setShortCents(short);
    onChange(draft);
  };

  return (
    <>
      <div className="row pay-editor__bonus" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }} data-testid="pay-bonus-box">
        <span className="muted" style={{ fontSize: 13 }} data-testid="pay-bonus-balance">{fmt(t("pay.bonusBalance"), money(balanceCents / 100))}</span>
        <Button type="button" variant="secondary" disabled={disabled || balanceCents <= 0} onClick={() => { void useAll(); }} data-testid="pay-bonus-use-all">
          {t("pay.bonusUseAll")}
        </Button>
      </div>
      {shortCents > 0 && (
        <div className="pay-editor__own-error" role="status" data-testid="pay-bonus-short">{fmt(t("pay.bonusShort"), money(shortCents / 100))}</div>
      )}
    </>
  );
};

export default BonusUseAll;
