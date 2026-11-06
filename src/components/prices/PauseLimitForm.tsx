import Button from "@/components/ui/Button";
import DurationInput from "@/components/sessions/DurationInput";
import { draftMinutes, draftOf, isDraftEmpty, EMPTY_DRAFT, type DurationDraft } from "@/components/sessions/durationModel";
import { IBillingSettings, chargedSlotsOf, includedJoysticks, maxJoystickSlotOf, pricingModeOf, strategyModeOf } from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { notify } from "@/ui/notify";
import { FormEvent, useState } from "react";
import { durationLabel } from "./vipMinimumCharge";

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
 *
 * Typed in the start dialog's time field (2026-11-06, owner: "[ч] : [мин]",
 * `DurationInput`), so an hour or more reads as hours; the server stores
 * minutes.
 */
const PauseLimitForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();
  const saved = settings.pause_limit_minutes ?? null;
  const [draft, setDraft] = useState<DurationDraft>(() => (saved === null ? EMPTY_DRAFT : draftOf(saved)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** The minutes typed: null = no limit (both boxes empty), NaN = not a valid limit. */
  const typed = ((): number | null => {
    if (isDraftEmpty(draft)) return null;
    return draftMinutes(draft, PAUSE_LIMIT_MAX) ?? NaN;
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
      <div className="col" style={{ gap: 4 }}>
        <span className="label">{t("pauseLimit.label")}</span>
        <DurationInput
          value={draft}
          onChange={setDraft}
          disabled={busy}
          label={t("pauseLimit.label")}
          maxMinutes={PAUSE_LIMIT_MAX}
          invalidText={fmt(t("pauseLimit.invalid"), durationLabel(PAUSE_LIMIT_MAX, t))}
          testId="pause-limit"
        />
        {/* Empty is a choice, not an omission: say what it means. */}
        {typed === null && <span className="muted" style={{ fontSize: 12 }} data-testid="pause-limit-none">{t("pauseLimit.none")}</span>}
      </div>
      {err && <div className="error">{err}</div>}
      <div>
        <Button type="submit" disabled={!changed || busy}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default PauseLimitForm;
