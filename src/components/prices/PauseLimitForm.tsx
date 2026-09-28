import Button from "@/components/ui/Button";
import { IBillingSettings, chargedSlotsOf, includedJoysticks, maxJoystickSlotOf, pricingModeOf, strategyModeOf } from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  settings: IBillingSettings;
  onSaved: () => void;
}

/**
 * The server's ceiling, mirrored so the form can refuse before a round trip.
 * `Branch::PAUSE_LIMIT_MAX` decides; the request is validated there regardless.
 */
export const PAUSE_LIMIT_MAX = 240;

/**
 * How long one pause may last in this venue.
 *
 * Empty is "no limit", which is what every branch is on until its owner says
 * otherwise. The limit is copied onto each pause when it begins, so changing it
 * here never shortens or stretches a pause already running — only the next one.
 * At the limit the BACKEND resumes the session by itself, whether or not any
 * panel is open.
 */
const PauseLimitForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();
  const saved = settings.pause_limit_minutes ?? null;
  const [input, setInput] = useState(saved === null ? "" : String(saved));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** The minutes typed: null = no limit, NaN = not a valid limit. */
  const typed = ((): number | null => {
    const raw = input.trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= PAUSE_LIMIT_MAX ? n : NaN;
  })();

  const invalid = typed !== null && Number.isNaN(typed);
  const changed = !invalid && typed !== saved;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      // A PUT of the whole policy: every joystick and rounding figure goes back
      // exactly as MoneyRoundingForm sends it, so saving the limit changes
      // nothing else. The room's answer is left out, which leaves it alone.
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
        pause_limit_minutes: typed,
      });
      notify.message("success", t("pauseLimit.saved"));
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <span className="muted" style={{ fontSize: 12 }}>{t("pauseLimit.hint")}</span>
      <label className="col" style={{ gap: 4 }}>
        <span className="label">{t("pauseLimit.label")}</span>
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            value={input}
            placeholder={t("pauseLimit.none")}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            aria-label={t("pauseLimit.label")}
            style={{ width: 120 }}
          />
          <span className="muted" style={{ fontSize: 12 }}>{t("time.minShort") || "min"}</span>
        </div>
      </label>
      {invalid && <span className="error" style={{ fontSize: 12 }}>{fmt(t("pauseLimit.invalid"), PAUSE_LIMIT_MAX)}</span>}
      {err && <div className="error">{err}</div>}
      <div>
        <Button type="submit" disabled={!changed || busy}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default PauseLimitForm;
