import Button from "@/components/ui/Button";
import PriceInput from "@/components/ui/PriceInput";
import { IBillingSettings } from "@/api/joystickPrices";
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
 * What one extra joystick costs. One figure, for every pad.
 *
 * It was three inputs — the second pad, the third and the fourth — because the
 * schema could express three prices. No venue ever set them differently, so the
 * screen asked an operator three questions with a single answer and left two of
 * them to be forgotten: a venue that filled in only the first found the "+"
 * button refusing the third pad with a sentence about a slot nobody had thought
 * about.
 *
 * **An empty box is a value, not a gap.** It means extra pads are not offered
 * here, and the session card refuses to add one with a sentence pointing back
 * at this screen. Clearing a set fee is therefore how a venue withdraws the
 * offer; sessions already holding pads are untouched, because each pad's fee
 * was frozen onto its own row when it was handed out.
 *
 * The fee is FIXED per use and the server owns every consequence of it: it goes
 * onto the bill when the pad is handed out and comes off when it is handed
 * back, whatever the time in between. Nothing here multiplies it by anything.
 */
const JoystickPricesForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();
  const stored = settings.joystick_price === null ? "" : String(settings.joystick_price);

  const [value, setValue] = useState(stored);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Numeric compare so a typed "500" matches a stored "500.00", and "" matches
  // unset — otherwise Save would light up on every render.
  const typed = value.trim() === "" ? null : Number(value);
  const changed = typed !== (settings.joystick_price ?? null);
  const invalid = typed !== null && (!Number.isFinite(typed) || typed < 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed || busy || invalid) return;
    setBusy(true);
    setErr(null);
    try {
      // The whole policy goes back, rounding included: this is a PUT and the
      // server validates it as one object, so sending half of it would blank
      // the other half.
      await billingSettingsRepository.update(
        branchId,
        settings.money_rounding_step,
        settings.money_rounding_mode,
        typed,
      );
      notify.message("success", t("joystickPrice.saved"));
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <span className="muted" style={{ fontSize: 12 }}>{t("joystickPrice.hint")}</span>

      <div style={{ maxWidth: 220 }}>
        <PriceInput
          label={t("joystickPrice.one")}
          value={value}
          onChange={setValue}
          disabled={busy}
        />
      </div>

      {err && <div className="error">{err}</div>}

      <div>
        <Button type="submit" disabled={!changed || busy || invalid}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default JoystickPricesForm;
