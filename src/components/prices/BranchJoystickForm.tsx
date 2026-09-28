import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import {
  CHARGED_SLOT_CHOICES, ChargedSlots, IBillingSettings, chargedSlotsOf, includedJoysticks,
  maxJoystickSlotOf, pricingModeOf, strategyModeOf,
} from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  settings: IBillingSettings;
  onSaved: () => void;
}

/**
 * What an extra joystick costs at this venue, and which ones are charged for.
 *
 * ## Why this screen is back
 *
 * The venue's answer is where every room's starts: a place set to "as the
 * branch does" carries no joystick columns of its own and
 * `JoystickRule` resolves the figure from here. When the joystick questions
 * moved onto the room's own form, this half went with them — and the answer a
 * room inherits became one nobody could set. Existing venues kept billing from
 * values entered before the move; a venue opened since had no way to have one.
 *
 * ## Deliberately smaller than what it replaced
 *
 * It asks two questions — which pads cost money, and how much — and leaves the
 * rest of the policy exactly as it found it. The strategy, the charge mode and
 * the fourth pad's separate figure are the ROOM's questions now, answered on
 * the place form, and asking them twice in two places is how two screens end up
 * disagreeing about one venue.
 *
 * `""` is "this venue has not answered", which every branch is until somebody
 * chooses, and it stays expressible: without it the page would light Save the
 * moment it rendered and an owner who came to read it could save a choice they
 * never made.
 */
const BranchJoystickForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();

  const storedSlots = chargedSlotsOf(settings);
  // A stored price reaches the box as text so that "500" typed matches
  // "500.00" stored and Save does not light up on a render.
  const storedPrice = settings.joystick_price === null || settings.joystick_price === undefined
    ? ""
    : String(settings.joystick_price);

  const [slots, setSlots] = useState<ChargedSlots | "">(storedSlots ?? "");
  const [price, setPrice] = useState(storedPrice);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Zero IS a price — a venue handing its extra pads out for nothing — so only
  // an empty box is "nothing named". `Number("")` is 0 and that is exactly the
  // confusion this keeps out of the payload.
  const outgoingPrice = price.trim() === "" ? null : Number(price);
  const invalid = outgoingPrice !== null && (! Number.isFinite(outgoingPrice) || outgoingPrice < 0);
  // Naming pads without naming their price is what the server refuses on a
  // room, for the same reason: the pads would be named here and priced
  // somewhere else.
  const incomplete = slots !== "" && outgoingPrice === null;

  const changed = (slots === "" ? null : slots) !== storedSlots || price.trim() !== storedPrice;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (! changed || busy || invalid || incomplete) return;
    setBusy(true);
    setErr(null);
    try {
      // The whole policy goes back: this is a PUT and the server validates it
      // as one object, so sending only this form's half would blank the
      // rounding rule and the venue's strategy.
      //
      // `joystick_strategy_mode` is the one field not echoed verbatim — a
      // branch may still hold the retired "both", which nothing may write any
      // more, so what goes back is the single answer it already resolves to.
      await billingSettingsRepository.update(branchId, {
        money_rounding_step: settings.money_rounding_step,
        money_rounding_mode: settings.money_rounding_mode,
        joystick_price: outgoingPrice,
        joystick_included: includedJoysticks(settings),
        joystick_charged_slots: slots === "" ? null : slots,
        joystick_pricing_mode: pricingModeOf(settings),
        joystick_price_4: settings.joystick_price_4 ?? null,
        joystick_max_slot: maxJoystickSlotOf(settings),
        joystick_strategy_mode: strategyModeOf(settings),
      });
      notify.message("success", t("branchJoystick.saved"));
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <span className="muted" style={{ fontSize: 12 }}>{t("branchJoystick.hint")}</span>

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("place.joystickScope")}</span>
          <select
            className="input"
            value={slots}
            disabled={busy}
            onChange={(e) => setSlots(e.target.value as ChargedSlots | "")}
            style={{ width: 180 }}
          >
            <option value="">{t("branchJoystick.unset")}</option>
            {CHARGED_SLOT_CHOICES.map((choice) => (
              <option key={choice} value={choice}>{t(`place.joystickScope.${choice}`)}</option>
            ))}
          </select>
        </label>

        <div style={{ minWidth: 180 }}>
          <PriceInput
            label={t("place.joystickPrice")}
            value={price}
            onChange={setPrice}
            disabled={busy}
          />
        </div>
      </div>

      {incomplete && <span className="error" style={{ fontSize: 11 }}>{t("branchJoystick.priceRequired")}</span>}
      {err && <div className="error">{err}</div>}

      <div>
        <Button type="submit" disabled={! changed || busy || invalid || incomplete}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default BranchJoystickForm;
