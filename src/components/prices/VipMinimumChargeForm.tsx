import Button from "@/components/ui/Button";
import Radio from "@/components/ui/Radio";
import Switch from "@/components/ui/Switch";
import DurationPicker from "@/components/sessions/DurationPicker";
import { minutesOf, type DurationUnit } from "@/components/sessions/durationModel";
import { minimumChargeBilledSeconds } from "@/components/sessions/sessionAmount";
import {
  IBillingSettings,
  chargedSlotsOf,
  includedJoysticks,
  maxJoystickSlotOf,
  pricingModeOf,
  strategyModeOf,
} from "@/api/joystickPrices";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { billingSettingsRepository } from "@/repositories/BillingSettingsRepository";
import { IMinimumChargeRule } from "@/types/sessions";
import { notify } from "@/ui/notify";
import { FormEvent, ReactNode, useState } from "react";
import VipMinimumChargePreview from "./VipMinimumChargePreview";
import {
  MINIMUM_PRESETS,
  THRESHOLD_PRESETS,
  VIP_MIN_MAX_MINUTES,
  durationFieldOf,
  durationLabel,
  ruleProblem,
  savedRule,
} from "./vipMinimumCharge";

interface Props {
  branchId: number;
  settings: IBillingSettings;
  /** The branch's VIP hourly rate, to price the examples at; null = none set. */
  vipRate: number | null;
  onSaved: () => void;
}

type DurationField = { unit: DurationUnit; amount: string };

/** One question of the form: what it asks, a line on what it means, the control. */
const Question = ({ title, hint, children }: { title: string; hint: string; children: ReactNode }) => (
  <div className="col vip-min-question" style={{ gap: 8 }}>
    <div className="col" style={{ gap: 2 }}>
      <span className="label">{title}</span>
      <span className="muted" style={{ fontSize: 12 }}>{hint}</span>
    </div>
    {children}
  </div>
);

/**
 * The VIP minimum charge for this branch, laid out as the owner thinks about
 * it: what happens to a short visit, to a long one, and to a moved one — said
 * in plain sentences with the owner's own numbers, then two questions (from
 * when, how much) and how to bill past the minimum, then a worked example.
 *
 * Lengths are typed in hours or minutes through the panel's one duration
 * control (`DurationPicker`, as on «+ Время»); the server stores minutes.
 *
 * Saved through the billing policy endpoint like every money rule here: the
 * fields every form sends, plus these four; the others are left out, which
 * leaves them alone. The server freezes the rule onto a visit as it first
 * sits on a VIP seat, so a change here applies to NEW visits only — said on
 * the form, because it is the consequence an owner must know before saving.
 */
const VipMinimumChargeForm = ({ branchId, settings, vipRate, onSaved }: Props) => {
  const { t, money } = useLang();
  const saved = savedRule(settings);
  const [enabled, setEnabled] = useState(!!settings.vip_min_charge_enabled);
  const [after, setAfter] = useState<DurationField>(() => durationFieldOf(settings.vip_min_charge_after_minutes ?? 20));
  const [minimum, setMinimum] = useState<DurationField>(() => durationFieldOf(settings.vip_min_charge_minutes ?? 60));
  const [mode, setMode] = useState<IMinimumChargeRule["mode"]>(settings.vip_min_charge_mode ?? "minimum");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const afterN = minutesOf(after.amount, after.unit, VIP_MIN_MAX_MINUTES);
  const minimumN = minutesOf(minimum.amount, minimum.unit, VIP_MIN_MAX_MINUTES);
  const problem = enabled ? ruleProblem(afterN, minimumN) : null;
  const rule: IMinimumChargeRule | null = enabled && !problem && afterN !== null && minimumN !== null
    ? { after_minutes: afterN, minimum_minutes: minimumN, mode }
    : null;
  const changed = enabled !== !!settings.vip_min_charge_enabled
    || (enabled && (saved === null || saved.after_minutes !== afterN || saved.minimum_minutes !== minimumN || saved.mode !== mode));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!changed || problem || busy) return;
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
        vip_min_charge_enabled: enabled,
        // Switched off, the values the owner had typed stay on the branch, so
        // switching it back on shows them.
        ...(rule ? { vip_min_charge_after_minutes: rule.after_minutes, vip_min_charge_minutes: rule.minimum_minutes, vip_min_charge_mode: rule.mode } : {}),
      });
      notify.message("success", t("vipMin.saved"));
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  // The worked case under each billing choice: ten minutes past the minimum.
  const pastMinimum = (minimumN ?? 60) + 10;
  const billedPast = (m: IMinimumChargeRule["mode"]) => Math.round(minimumChargeBilledSeconds(
    { after_minutes: afterN ?? 1, minimum_minutes: minimumN ?? 60, mode: m },
    pastMinimum * 60,
  ) / 60);
  const modeLabel = (m: IMinimumChargeRule["mode"], key: string) =>
    fmt(t(key), durationLabel(pastMinimum, t), durationLabel(billedPast(m), t));

  const d = (minutes: number) => durationLabel(minutes, t);

  return (
    <form className="col vip-min-form" style={{ gap: 16 }} onSubmit={submit}>
      <Switch checked={enabled} onChange={setEnabled} label={t("vipMin.enable")} disabled={busy} />

      {!enabled && <span className="muted" style={{ fontSize: 13 }}>{t("vipMin.off")}</span>}

      {enabled && (
        <>
          {rule && (
            <ul className="vip-min-rules" role="status" data-testid="vip-min-rules">
              <li>{fmt(t("vipMin.rule.short"), d(rule.after_minutes))}</li>
              <li>{fmt(t("vipMin.rule.long"), d(rule.after_minutes), d(rule.minimum_minutes))}</li>
              <li>
                {fmt(
                  t(rule.mode === "minimum" ? "vipMin.rule.pastPerMinute" : "vipMin.rule.pastRoundUp"),
                  d(rule.minimum_minutes),
                )}
              </li>
              <li>{t("vipMin.rule.move")}</li>
            </ul>
          )}

          <Question title={t("vipMin.after")} hint={t("vipMin.afterHint")}>
            <DurationPicker
              unit={after.unit}
              amount={after.amount}
              onChange={setAfter}
              disabled={busy}
              label={t("vipMin.after")}
              presets={THRESHOLD_PRESETS}
              maxMinutes={VIP_MIN_MAX_MINUTES}
              invalidText={t("vipMin.invalidDuration")}
            />
          </Question>

          <Question title={t("vipMin.minimum")} hint={t("vipMin.minimumHint")}>
            <DurationPicker
              unit={minimum.unit}
              amount={minimum.amount}
              onChange={setMinimum}
              disabled={busy}
              label={t("vipMin.minimum")}
              presets={MINIMUM_PRESETS}
              maxMinutes={VIP_MIN_MAX_MINUTES}
              invalidText={t("vipMin.invalidDuration")}
            />
          </Question>

          <Question title={t("vipMin.then")} hint={t("vipMin.thenHint")}>
            <div className="col" style={{ gap: 6 }}>
              <Radio name={`vip-min-mode-${branchId}`} checked={mode === "minimum"} onChange={() => setMode("minimum")} label={modeLabel("minimum", "vipMin.mode.minimum")} disabled={busy} />
              <Radio name={`vip-min-mode-${branchId}`} checked={mode === "round_up"} onChange={() => setMode("round_up")} label={modeLabel("round_up", "vipMin.mode.roundUp")} disabled={busy} />
            </div>
          </Question>

          {problem === "vipMin.minimumBelowThreshold" && afterN !== null && minimumN !== null && (
            <span className="error" style={{ fontSize: 12 }}>{fmt(t(problem), d(minimumN), d(afterN))}</span>
          )}

          {rule && (
            <div className="vip-min-summary">
              {vipRate !== null ? (
                <>
                  <span className="label">{fmt(t("vipMin.preview.title"), money(vipRate))}</span>
                  <VipMinimumChargePreview rule={rule} rate={vipRate} />
                </>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>{t("vipMin.preview.noRate")}</span>
              )}
            </div>
          )}
        </>
      )}

      {changed && <span className="vip-min-warning">{t("vipMin.appliesToNew")}</span>}
      {err && <div className="error">{err}</div>}
      <div>
        <Button type="submit" disabled={!changed || !!problem || busy}>{t("action.save")}</Button>
      </div>
    </form>
  );
};

export default VipMinimumChargeForm;
