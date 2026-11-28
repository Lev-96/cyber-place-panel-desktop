import UnpaidToggle from "@/components/sessions/UnpaidToggle";
import { bonusAmountText } from "@/components/bonus/bonusAmount";
import Button from "@/components/ui/Button";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { bonusRepository } from "@/repositories/BonusRepository";
import type { IBonusAccount } from "@/types/bonus";
import { useState } from "react";
import BonusCardPicker from "./BonusCardPicker";

interface Props {
  branchId: number;
  disabled?: boolean;
  value: IBonusAccount | null;
  onChange: (account: IBonusAccount | null) => void;
}

/**
 * «Бонусная карта» in Start (2026-11-25), under «Свои продукты». Drawn only
 * where the branch has bonuses switched on. It never changes what Start sends:
 * the card chosen is bound to the seat AFTER it started (StartSessionDialog).
 */
const BonusCardStartSwitch = ({ branchId, disabled, value, onChange }: Props) => {
  const { t, money } = useLang();
  const [on, setOn] = useState(value !== null);
  const [picking, setPicking] = useState(false);
  // A read that fails draws nothing: Start must never be blocked by bonuses.
  const settings = useAsync(() => bonusRepository.settings(branchId).catch(() => null), [branchId]);
  if (!settings.data?.enabled) return null;

  const toggle = (next: boolean) => {
    setOn(next);
    if (!next) onChange(null);
    else if (value === null) setPicking(true);
  };

  return (
    // Its own tile, as large as «Бесплатная сессия» (2026-11-25, owner), in
    // the Club Card's colour; the line under it says what it does.
    <div className={["start-dialog__free start-dialog__bonus", on ? "is-on" : null].filter(Boolean).join(" ")} data-testid="start-bonus-card">
      <UnpaidToggle on={on} onChange={toggle} disabled={disabled}
        label={t("bonus.start.switch")} fullLabel={t("bonus.start.switchFull")} testId="bonus-card-switch" tone="bonus" />
      {!on && <span className="muted start-dialog__free-hint" data-testid="bonus-card-hint">{t("bonus.start.hint")}</span>}
      {on && (
        <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {value && (
            <span className="muted start-dialog__switch-hint" data-testid="bonus-card-chosen">
              {(value.name || t("bonus.noName")) + ", " + value.phone + ", " + t("bonus.balance").replace("{0}", bonusAmountText(money, value.balance))}
            </span>
          )}
          <Button type="button" variant="secondary" disabled={disabled} onClick={() => setPicking(true)} data-testid="bonus-card-pick">
            {value ? t("bonus.start.change") : t("bonus.start.pick")}
          </Button>
        </div>
      )}
      {picking && (
        <BonusCardPicker branchId={branchId} rankNames={settings.data.rank?.names}
          onClose={() => { setPicking(false); if (value === null) setOn(false); }}
          onPick={(a) => { onChange(a); setPicking(false); }} />
      )}
    </div>
  );
};

export default BonusCardStartSwitch;
