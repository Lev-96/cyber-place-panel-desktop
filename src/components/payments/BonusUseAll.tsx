import Button from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { centsWhenFractional } from "@/i18n/currency";
import { fmt } from "@/i18n/translations";
import { useState } from "react";
import { partCents, useAllBonuses, useSomeBonuses, type PaymentDraft } from "./paymentSplit";

interface Props {
  balanceCents: number;
  dueCents: number;
  value: PaymentDraft;
  onChange: (next: PaymentDraft) => void;
  disabled?: boolean;
}

/**
 * The card's balance and «Использовать все бонусы» (2026-11-25, owner): asked
 * once in a confirmation, never more than the bill; too few bonuses → the
 * rest is put on cash and the shortfall is said, so the cashier takes it
 * another way. Drawn only where a card is bound (PaymentEditor's `bonus`).
 */
/** Cents as the box shows them: «193.89», «200». */
const toAmountText = (cents: number): string => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

const BonusUseAll = ({ balanceCents, dueCents, value, onChange, disabled }: Props) => {
  // Sums to the cent (QA 2026-11-25): «40.28», never a rounded «40».
  const { t, money: fmtMoney } = useLang();
  const exact = (cents: number) => fmtMoney(cents / 100, centsWhenFractional(cents / 100));
  const confirm = useConfirm();
  const [shortCents, setShortCents] = useState(0);
  // «Сколько бонусами» (2026-11-25, owner): a part of the bill from the card.
  const [part, setPart] = useState("");
  const cap = Math.min(balanceCents, dueCents);
  // Applied as it is typed (2026-11-25, owner: no «Применить»): the sum goes
  // on bonuses, the rest on cash; more than the card or the bill holds is
  // cut to that. Cleared → no bonuses, the whole bill in cash. Nothing is
  // spent until the dialog is confirmed.
  const typePart = (raw: string) => {
    const typed = partCents(raw);
    if (raw.trim() !== "" && typed === null) return; // letters never land
    const want = typed ?? 0;
    const shown = want > cap ? toAmountText(cap) : raw;
    setPart(shown);
    setShortCents(0);
    onChange(useSomeBonuses(dueCents, value, balanceCents, Math.min(want, cap)));
  };

  const useAll = async () => {
    const spend = Math.min(balanceCents, dueCents);
    const ok = await confirm(fmt(t("pay.bonusUseAllConfirm"), exact(spend)), { confirmLabel: t("pay.bonusUseAll") });
    if (!ok) return;
    const { draft, shortCents: short } = useAllBonuses(dueCents, value, balanceCents);
    setShortCents(short);
    setPart("");
    onChange(draft);
  };

  return (
    <>
      <div className="row pay-editor__bonus" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }} data-testid="pay-bonus-box">
        <span className="pay-editor__bonus-balance" data-testid="pay-bonus-balance">{fmt(t("pay.bonusBalance"), exact(balanceCents))}</span>
        <Button type="button" variant="secondary" disabled={disabled || balanceCents <= 0} onClick={() => { void useAll(); }} data-testid="pay-bonus-use-all">
          {t("pay.bonusUseAll")}
        </Button>
      </div>
      <div className="row pay-editor__bonus-part" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }} data-testid="pay-bonus-part">
        <span className="pay-editor__bonus-part-label">{t("pay.bonusPartLabel")}</span>
        <input className="input pay-editor__bonus-part-input" type="text" inputMode="decimal" value={part} disabled={disabled || balanceCents <= 0}
          onChange={(e) => typePart(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          placeholder={exact(cap)} aria-label={t("pay.bonusPartLabel")} data-testid="pay-bonus-part-input" />
        <span className="muted" style={{ fontSize: 13 }}>{fmt(t("pay.bonusPartMax"), exact(cap))}{" · "}{t("pay.bonusPartRest")}</span>
      </div>
      {shortCents > 0 && (
        <div className="pay-editor__own-error" role="status" data-testid="pay-bonus-short">{fmt(t("pay.bonusShort"), exact(shortCents))}</div>
      )}
    </>
  );
};

export default BonusUseAll;
