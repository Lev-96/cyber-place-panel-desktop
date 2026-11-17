import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import Radio from "@/components/ui/Radio";
import { IBillingSettings, OutsideFoodMode, chargedSlotsOf, includedJoysticks, maxJoystickSlotOf, pricingModeOf, strategyModeOf } from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useCallback, useState } from "react";
import OutsideFoodPlacesField from "./OutsideFoodPlacesField";
import { FeePlace, PlaceDrafts, changedPlaceFees, placesSummary } from "./outsideFoodPlaces";

interface Props {
  branchId: number;
  settings: IBillingSettings;
  /** The branch's places (`listRawByBranch`); null while loading or when the read failed. */
  places: readonly FeePlace[] | null;
  placesError: unknown;
  onRetryPlaces: () => void;
  /** "PS5", or a venue's own platform name. */
  platformName: (slug: string) => string;
  /** Called after a Save; the page reloads the policy AND the places. */
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
 * carry its own figure, which beats these: set below the tiers (2026-11-14,
 * `OutsideFoodPlacesField`) or in the place form — both write the one column,
 * `places.outside_food_fee`.
 *
 * The figure is frozen onto a session at its Start, so a change here reaches
 * only the next start. Saved through the PUT of the whole policy, like the
 * other rules on this page: every answer it does not own goes back as it was,
 * and the fields it does not know about are left out (left alone). The places
 * travel with the same Save as `outside_food_place_fees`, ONLY the changed
 * rows; none changed (or the places did not load) = the key is left out.
 */
const OutsideFoodFeeForm = ({ branchId, settings, places, placesError, onRetryPlaces, platformName, onSaved }: Props) => {
  const { t } = useLang();
  const savedStandard = settings.outside_food_fee_standard ?? null;
  const savedVip = settings.outside_food_fee_vip ?? null;
  const [standard, setStandard] = useState(() => boxOf(savedStandard));
  const [vip, setVip] = useState(() => boxOf(savedVip));
  /**
   * How the figure is charged (2026-11-17, owner): one fixed line, as it has
   * always been, or — «Изменение тарифа», the pads' word — the seat's hourly
   * rate while own food is on (a 2 500/h VIP seat with own food at 4 000 is a
   * 4 000/h seat), switched on at the start or during the game.
   */
  const savedMode: OutsideFoodMode = settings.outside_food_mode === "tariff" ? "tariff" : "fixed";
  const [mode, setMode] = useState<OutsideFoodMode>(savedMode);
  const [drafts, setDrafts] = useState<PlaceDrafts>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const standardFee = feeOf(standard);
  const vipFee = feeOf(vip);
  const placeRows = places ? changedPlaceFees(places, drafts) : [];
  const placesInvalid = places ? placesSummary(places, drafts).invalid > 0 : false;
  const invalid = Number.isNaN(standardFee) || Number.isNaN(vipFee) || placesInvalid;
  const changed = !invalid && (standardFee !== savedStandard || vipFee !== savedVip || placeRows.length > 0 || mode !== savedMode);

  const setPlaceBox = useCallback((placeId: number, box: string) => {
    setDrafts((cur) => ({ ...cur, [placeId]: box }));
  }, []);
  // The tier figure a place «like the branch» gets, as the tier box reads
  // right now; a box that says nothing valid (a typed 0) shows the stored one.
  const branchFeeFor = (type: string): number | null => {
    const typed = type === "vip" ? vipFee : standardFee;
    if (!Number.isNaN(typed)) return typed;
    return type === "vip" ? savedVip : savedStandard;
  };

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
        // Only when it changed: a Save of the figures alone sends the body it
        // always sent, and the server leaves an absent field as it is.
        ...(mode !== savedMode ? { outside_food_mode: mode } : {}),
        ...(placeRows.length > 0 ? { outside_food_place_fees: placeRows } : {}),
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
      <div className="col" style={{ gap: 6 }}>
        <span className="label">{t("outsideFood.mode")}</span>
        <div className="cp-choice-row" role="radiogroup" aria-label={t("outsideFood.mode")}>
          {(["fixed", "tariff"] as const).map((m) => (
            <div key={m} className={`cp-choice${mode === m ? " is-active" : ""}`}>
              <Radio
                name={`outside-food-mode-${branchId}`}
                checked={mode === m}
                onChange={() => setMode(m)}
                disabled={busy}
                label={t(m === "tariff" ? "joystickPrice.strategy.hourly" : "joystickPrice.strategy.fixed")}
              />
            </div>
          ))}
        </div>
        <span className="muted outside-food-form__note" data-testid="outside-food-mode-note">
          {t(mode === "tariff" ? "outsideFood.modeTariffNote" : "outsideFood.modeFixedNote")}
        </span>
      </div>
      <div className="outside-food-form__tiers">
        {tier(t("outsideFood.standard"), standard, setStandard, standardFee)}
        {tier(t("outsideFood.vip"), vip, setVip, vipFee)}
      </div>
      <span className="muted outside-food-form__hint">{t("outsideFood.placeHint")}</span>
      <OutsideFoodPlacesField
        places={places}
        placesError={placesError}
        onRetryPlaces={onRetryPlaces}
        drafts={drafts}
        onChange={setPlaceBox}
        branchFeeFor={branchFeeFor}
        platformName={platformName}
        disabled={busy}
      />
      {changed && <span className="vip-min-warning">{t("outsideFood.places.appliesToNew")}</span>}
      {err && <div className="error">{err}</div>}
      <div>
        <Button type="submit" disabled={!changed || busy}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default OutsideFoodFeeForm;
