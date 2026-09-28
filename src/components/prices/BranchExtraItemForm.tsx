import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import {
  IBillingSettings, includedJoysticks, maxJoystickSlotOf, pricingModeOf, strategyModeOf,
  chargedSlotsOf,
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
 * What THIS VENUE hands out, for the rooms that have not said.
 *
 * The pads' own screen, one domain over. A custom-platform room answers seven
 * questions on its own form — what it hands out, what one costs, how many are
 * in the rate, how many exist, which ones are charged, per piece or per hour,
 * every time or once a session — and a venue running ten billiard tables had
 * to answer them ten times. `ExtraItemRule` resolves the room first and this
 * second, exactly as `JoystickRule` resolves a place then its branch.
 *
 * ## Empty is a real answer, and it is the one every venue starts on
 *
 * `""` is "this venue has not answered", which leaves every room speaking for
 * itself — the behaviour every branch had before this screen existed. Without
 * it the page would light Save the moment it rendered, and an owner who came
 * to read it could store a choice they never made.
 *
 * ⚠️ A zero is NOT empty. A venue pricing its cues at 0 hands them out for
 * nothing, and an allowance of 0 says "none of them are in the rate" — both
 * are decisions, and `Number("")` being 0 is exactly the confusion this keeps
 * out of the payload.
 */
const BranchExtraItemForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();

  const storedName = settings.extra_item_name ?? "";
  const storedPrice = settings.extra_item_price ?? "";
  const storedIncluded = settings.extra_item_included != null ? String(settings.extra_item_included) : "";
  const storedMax = settings.extra_item_max != null ? String(settings.extra_item_max) : "";
  const storedUnits = settings.extra_item_charged_units ?? "";
  const storedPriceNext = settings.extra_item_price_next ?? "";
  const storedPricing = settings.extra_item_pricing_mode ?? "fixed";
  const storedCharge = settings.extra_item_charge_mode ?? "each";

  const [name, setName] = useState(storedName);
  const [price, setPrice] = useState(String(storedPrice));
  const [included, setIncluded] = useState(storedIncluded);
  const [max, setMax] = useState(storedMax);
  const [units, setUnits] = useState(storedUnits);
  const [priceNext, setPriceNext] = useState(String(storedPriceNext));
  const [pricing, setPricing] = useState<"fixed" | "hourly">(storedPricing);
  const [charge, setCharge] = useState<"each" | "once">(storedCharge);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const outgoingPrice = price.trim() === "" ? null : Number(price);
  const named = name.trim() !== "";
  const invalid = outgoingPrice !== null && (! Number.isFinite(outgoingPrice) || outgoingPrice < 0);
  // Naming the thing without pricing it is what the server refuses on a room,
  // for the same reason: it would be named here and priced somewhere else.
  const incomplete = named && outgoingPrice === null;

  const changed =
    name.trim() !== storedName
    || price.trim() !== String(storedPrice)
    || included.trim() !== storedIncluded
    || max.trim() !== storedMax
    || units.trim() !== storedUnits
    || priceNext.trim() !== String(storedPriceNext)
    || pricing !== storedPricing
    || charge !== storedCharge;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (! changed || busy || invalid || incomplete) return;
    setBusy(true);
    setErr(null);
    try {
      // The whole policy goes back: this is a PUT and the server validates it
      // as one object, so sending only this form's half would blank the
      // rounding rule and every joystick answer beside it.
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
        // Every one of these is nulled when its box is empty, because empty is
        // "the venue has not answered" and null is how that travels.
        extra_item_name: named ? name.trim() : null,
        extra_item_price: named ? outgoingPrice : null,
        extra_item_charge_mode: named ? charge : null,
        extra_item_pricing_mode: named ? pricing : null,
        extra_item_included: named && included.trim() !== "" ? Number(included) : null,
        extra_item_max: named && max.trim() !== "" ? Number(max) : null,
        extra_item_charged_units: named && units.trim() !== "" ? units.trim() : null,
        // Empty is "priced like the first", never "free" — so an empty box
        // travels as null and a typed 0 travels as 0.
        extra_item_price_next:
          named && priceNext.trim() !== "" ? Number(priceNext) : null,
      });
      notify.message("success", t("branchExtraItem.saved"));
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const digits = (v: string) => v.replace(/[^0-9]/g, "");

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <span className="muted" style={{ fontSize: 12 }}>{t("branchExtraItem.hint")}</span>

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: 180 }}>
          <Input
            label={t("branchExtraItem.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            disabled={busy}
          />
        </div>

        <div style={{ minWidth: 180 }}>
          <PriceInput
            label={t("place.extraItemPrice")}
            value={price}
            onChange={setPrice}
            disabled={busy}
          />
        </div>

        <div style={{ minWidth: 180 }}>
          <PriceInput
            label={t("place.extraItemPriceNext")}
            value={priceNext}
            onChange={setPriceNext}
            disabled={busy}
          />
        </div>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ maxWidth: 160 }}>
          <Input
            label={t("place.extraItemIncluded")}
            value={included}
            onChange={(e) => setIncluded(digits(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            maxLength={3}
            disabled={busy}
          />
        </div>

        <div style={{ maxWidth: 160 }}>
          <Input
            label={t("place.extraItemMax")}
            value={max}
            onChange={(e) => setMax(digits(e.target.value))}
            inputMode="numeric"
            placeholder="∞"
            maxLength={3}
            disabled={busy}
          />
        </div>

        <div style={{ maxWidth: 160 }}>
          <Input
            label={t("place.extraItemChargedUnits")}
            value={units}
            onChange={(e) => setUnits(e.target.value.replace(/[^0-9,]/g, ""))}
            inputMode="numeric"
            placeholder="3,4"
            maxLength={64}
            disabled={busy}
          />
        </div>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("branchExtraItem.pricingMode")}</span>
          <select
            className="input"
            value={pricing}
            disabled={busy}
            onChange={(e) => setPricing(e.target.value as "fixed" | "hourly")}
            style={{ width: 180 }}
          >
            <option value="fixed">{t("place.extraItemModeFixed")}</option>
            <option value="hourly">{t("place.extraItemModeHourly")}</option>
          </select>
        </label>

        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("branchExtraItem.chargeMode")}</span>
          <select
            className="input"
            value={charge}
            disabled={busy}
            onChange={(e) => setCharge(e.target.value as "each" | "once")}
            style={{ width: 180 }}
          >
            <option value="each">{t("place.extraItemEach")}</option>
            <option value="once">{t("place.extraItemOnce")}</option>
          </select>
        </label>
      </div>

      {incomplete && <span className="error" style={{ fontSize: 11 }}>{t("branchExtraItem.priceRequired")}</span>}
      {err && <div className="error">{err}</div>}

      <div>
        <Button type="submit" disabled={! changed || busy || invalid || incomplete}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default BranchExtraItemForm;
