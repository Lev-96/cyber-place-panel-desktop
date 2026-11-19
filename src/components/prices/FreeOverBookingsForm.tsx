import UnpaidToggle from "@/components/sessions/UnpaidToggle";
import { IBillingSettings, chargedSlotsOf, includedJoysticks, maxJoystickSlotOf, pricingModeOf, strategyModeOf } from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { notify } from "@/ui/notify";
import { useState } from "react";

interface Props {
  branchId: number;
  settings: IBillingSettings;
  onSaved: () => void;
}

/**
 * The owner's switch (2026-11-19): a FREE session may start on a reserved
 * seat while its player has not come. Saved the moment it is flipped, as a
 * PUT of the whole policy exactly as `PauseLimitForm` sends it, so nothing
 * else changes. The page is the owner's (the server refuses a manager).
 */
const FreeOverBookingsForm = ({ branchId, settings, onSaved }: Props) => {
  const { t } = useLang();
  const [on, setOn] = useState<boolean>(settings.free_session_over_bookings === true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const flip = async (next: boolean) => {
    if (busy) return;
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
        free_session_over_bookings: next,
      });
      setOn(next);
      notify.message("success", t(next ? "freeOverBookings.on" : "freeOverBookings.off"));
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col" style={{ gap: 10 }} data-testid="free-over-bookings">
      <span className="muted" style={{ fontSize: 12 }}>{t("freeOverBookings.hint")}</span>
      <div>
        <UnpaidToggle
          on={on}
          onChange={(next) => void flip(next)}
          disabled={busy}
          label={t("freeOverBookings.switch")}
          fullLabel={t("freeOverBookings.switchFull")}
          testId="free-over-bookings-switch"
          tone="free"
        />
      </div>
      {err && <div className="error">{err}</div>}
    </div>
  );
};

export default FreeOverBookingsForm;
