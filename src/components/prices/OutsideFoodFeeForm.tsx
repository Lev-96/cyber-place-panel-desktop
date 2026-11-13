import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import { IBillingSettings, chargedSlotsOf, includedJoysticks, maxJoystickSlotOf, pricingModeOf, strategyModeOf } from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  settings: IBillingSettings;
  onSaved: () => void;
}

/** The stored figure as the box holds it (AMD, a string; empty = not charged). */
const boxOf = (fee: number | null | undefined): string => (fee == null ? "" : String(fee));

/**
 * What a box says: null = not charged (empty), a figure above 0, or NaN for
 * a 0 (or anything else that is not a fee) — refused here as the server
 * refuses it, because "not charged" is the empty box and two ways to say one
 * thing drift.
 */
const feeOf = (box: string): number | null => {
  if (box.trim() === "") return null;
  const n = Number(box);
  return Number.isFinite(n) && n > 0 ? n : NaN;
};

/**
 * «Свои продукты» (2026-11-13, owner): what the club charges a player who
 * brings their own food, switched on in the Start dialog. One figure for the
 * branch's standard seats and one for its VIP seats; an empty box is "not
 * charged on those seats" and the switch is not offered there. A place may
 * carry its own figure (the place form), which beats these.
 *
 * The figure is frozen onto a session at its Start, so a change here reaches
 * only the next start. Saved through the PUT of the whole policy, like the
 * other rules on this page: every answer it does not own goes back as it was,
 * and the fields it does not know about are left out (left alone).
 */
const OutsideFoodFeeForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();
  const savedStandard = settings.outside_food_fee_standard ?? null;
  const savedVip = settings.outside_food_fee_vip ?? null;
  const [standard, setStandard] = useState(() => boxOf(savedStandard));
  const [vip, setVip] = useState(() => boxOf(savedVip));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const standardFee = feeOf(standard);
  const vipFee = feeOf(vip);
  const invalid = Number.isNaN(standardFee) || Number.isNaN(vipFee);
  const changed = !invalid && (standardFee !== savedStandard || vipFee !== savedVip);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await billingSettingsRepository.update(branchId, {
        money_rounding_step: settings.money_rounding_step,
        money_rounding_mode: settings.money_rounding_mode,
        joystick_price: settings.joystick_price,
        joystick_included: includedJoysticks(settings),
        joystick_charged_slots: chargedSlotsOf(settings),
        joystick_pricing_mode: pricingModeOf(settings),
        joystick_price_4: settings.joystick_price_4 ?? null,
        joystick_max_slot: maxJoystickSlotOf(settings),
        joystick_strategy_mode: strategyModeOf(settings),
        outside_food_fee_standard: standardFee,
        outside_food_fee_vip: vipFee,
      });
      notify.message("success", t("outsideFood.saved"));
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const tier = (label: string, value: string, onChange: (v: string) => void, fee: number | null) => (
    <div className="outside-food-form__tier">
      <PriceInput label={label} value={value} onChange={onChange} placeholder="" disabled={busy} />
      {fee === null && <span className="muted outside-food-form__note">{t("outsideFood.notCharged")}</span>}
      {Number.isNaN(fee) && <span className="error outside-food-form__note">{t("outsideFood.zeroRefused")}</span>}
    </div>
  );

  return (
    <form className="col outside-food-form" onSubmit={submit}>
      <span className="muted outside-food-form__hint">{t("outsideFood.hint")}</span>
      <div className="outside-food-form__tiers">
        {tier(t("outsideFood.standard"), standard, setStandard, standardFee)}
        {tier(t("outsideFood.vip"), vip, setVip, vipFee)}
      </div>
      <span className="muted outside-food-form__hint">{t("outsideFood.placeHint")}</span>
      {err && <div className="error">{err}</div>}
      <div>
        <Button type="submit" disabled={!changed || busy}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default OutsideFoodFeeForm;
