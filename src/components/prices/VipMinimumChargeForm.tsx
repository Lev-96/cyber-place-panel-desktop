import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import SectionTabs from "@/components/ui/SectionTabs";
import Switch from "@/components/ui/Switch";
import DurationInput from "@/components/sessions/DurationInput";
import { draftMinutes, draftOf, type DurationDraft } from "@/components/sessions/durationModel";
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
  MINIMUM_CHARGE_SCOPES,
  MinimumChargeScope,
  RateOption,
  SeatTier,
  VIP_MIN_MAX_MINUTES,
  durationLabel,
  placeIdsOf,
  ruleProblem,
  savedRule,
  scopeOf,
  tiersOf,
} from "./vipMinimumCharge";

/** A seat the rule may be put on. */
export interface MinimumChargeSeat {
  id: number;
  number?: number;
  name?: string | null;
  type: string;
  platform: string;
  status?: string;
}

interface Props {
  branchId: number;
  settings: IBillingSettings;
  /** The branch's seats, for «choose seats» and for the example's prices. */
  seats: readonly MinimumChargeSeat[];
  /** The branch's hourly prices for these tiers, the example's default first. */
  rateOptionsFor: (tiers: readonly SeatTier[]) => RateOption[];
  /** "PS5", or a venue's own platform name. */
  platformName: (slug: string) => string;
  onSaved: () => void;
}

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

const sameIds = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && [...a].sort((x, y) => x - y).every((id, i) => id === [...b].sort((x, y) => x - y)[i]);

/**
 * The branch's minimum charge (2026-11-06, owner: no longer VIP-only), laid
 * out as the owner thinks about it: which seats, from when, how much — then
 * the rule in plain sentences with the owner's own numbers and a worked
 * example. Past the minimum it is always by the minute.
 *
 * Lengths are the start dialog's time field ("[1] ч : [30] мин",
 * `DurationInput`); the server stores minutes. Saved through the billing
 * policy endpoint like every money rule here: the fields every form sends,
 * plus these; the others are left out, which leaves them alone. The server
 * freezes the rule onto a visit as it first sits on a covered seat, so a
 * change here applies to NEW visits only — said on the form.
 */
const VipMinimumChargeForm = ({ branchId, settings, seats, rateOptionsFor, platformName, onSaved }: Props) => {
  const { t, money } = useLang();
  const saved = savedRule(settings);
  const savedScope = scopeOf(settings);
  const savedIds = placeIdsOf(settings);
  const [enabled, setEnabled] = useState(!!settings.vip_min_charge_enabled);
  const [after, setAfter] = useState<DurationDraft>(() => draftOf(settings.vip_min_charge_after_minutes ?? 20));
  const [minimum, setMinimum] = useState<DurationDraft>(() => draftOf(settings.vip_min_charge_minutes ?? 60));
  const [scope, setScope] = useState<MinimumChargeScope>(savedScope);
  const [chosen, setChosen] = useState<number[]>(savedIds);
  const [exampleKey, setExampleKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const afterN = draftMinutes(after, VIP_MIN_MAX_MINUTES);
  const minimumN = draftMinutes(minimum, VIP_MIN_MAX_MINUTES);
  const noSeats = scope === "places" && chosen.length === 0;
  const problem = !enabled ? null : ruleProblem(afterN, minimumN) ?? (noSeats ? "vipMin.scope.none" : null);
  const rule: IMinimumChargeRule | null = enabled && !problem && afterN !== null && minimumN !== null
    ? { after_minutes: afterN, minimum_minutes: minimumN, mode: "minimum" }
    : null;
  const changed = enabled !== !!settings.vip_min_charge_enabled
    || (enabled && (
      saved === null
      || saved.after_minutes !== afterN
      || saved.minimum_minutes !== minimumN
      || saved.mode !== "minimum"
      || scope !== savedScope
      || (scope === "places" && !sameIds(chosen, savedIds))
    ));

  const toggleSeat = (id: number, on: boolean) =>
    setChosen((cur) => (on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id)));

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
        // switching it back on shows them. The chosen seats travel only with
        // «choose seats»; another scope keeps them on the branch.
        ...(rule ? {
          vip_min_charge_after_minutes: rule.after_minutes,
          vip_min_charge_minutes: rule.minimum_minutes,
          vip_min_charge_mode: "minimum" as const,
          vip_min_charge_scope: scope,
          ...(scope === "places" ? { vip_min_charge_place_ids: chosen } : {}),
        } : {}),
      });
      notify.message("success", t("vipMin.saved"));
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const d = (minutes: number) => durationLabel(minutes, t);
  const options = rateOptionsFor(tiersOf(scope, seats, chosen));
  const example = options.find((o) => o.key === exampleKey) ?? options[0] ?? null;
  const optionText = (o: RateOption) =>
    fmt(t(o.tier === "vip" ? "vipMin.preview.option" : "vipMin.preview.optionStandard"), o.label, money(o.rate));
  const seatLabel = (s: MinimumChargeSeat) =>
    [`№${s.number ?? s.id}`, s.name?.trim() || null, platformName(s.platform), s.type === "vip" ? "VIP" : null]
      .filter(Boolean).join(" · ");
  const sortedSeats = [...seats].sort((a, b) => (a.number ?? a.id) - (b.number ?? b.id));
  const scopeRule = scope === "places"
    ? fmt(t("vipMin.rule.scope.places"), String(chosen.length))
    : t(`vipMin.rule.scope.${scope}`);

  return (
    <form className="col vip-min-form" style={{ gap: 16 }} onSubmit={submit}>
      <Switch checked={enabled} onChange={setEnabled} label={t("vipMin.enable")} disabled={busy} size="lg" testId="vip-min-enabled" />

      {!enabled && <span className="muted" style={{ fontSize: 13 }}>{t("vipMin.off")}</span>}

      {enabled && (
        <>
          {rule && (
            <ul className="vip-min-rules" role="status" data-testid="vip-min-rules">
              <li>{scopeRule}</li>
              <li>{fmt(t("vipMin.rule.short"), d(rule.after_minutes))}</li>
              <li>{fmt(t("vipMin.rule.long"), d(rule.after_minutes), d(rule.minimum_minutes))}</li>
              <li>{fmt(t("vipMin.rule.pastPerMinute"), d(rule.minimum_minutes))}</li>
              <li>{t("vipMin.rule.move")}</li>
            </ul>
          )}

          <Question title={t("vipMin.scope")} hint={t("vipMin.scopeHint")}>
            <SectionTabs
              label={t("vipMin.scope")}
              value={scope}
              disabled={busy}
              tabs={MINIMUM_CHARGE_SCOPES.map((key) => ({
                key,
                label: t(`vipMin.scope.${key}`),
                ...(key === "places" ? { count: chosen.length } : {}),
              }))}
              onChange={setScope}
            />
            {scope === "places" && (
              sortedSeats.length === 0 ? (
                <span className="muted" style={{ fontSize: 12 }}>{t("vipMin.scope.noSeats")}</span>
              ) : (
                <div className="vip-min-seats" role="group" aria-label={t("vipMin.scope.places")} data-testid="vip-min-seats">
                  {sortedSeats.map((s) => (
                    <Checkbox
                      key={s.id}
                      checked={chosen.includes(s.id)}
                      onChange={(on) => toggleSeat(s.id, on)}
                      disabled={busy}
                      label={seatLabel(s)}
                    />
                  ))}
                </div>
              )
            )}
          </Question>

          <Question title={t("vipMin.after")} hint={t("vipMin.afterHint")}>
            <DurationInput
              value={after}
              onChange={setAfter}
              disabled={busy}
              label={t("vipMin.after")}
              maxMinutes={VIP_MIN_MAX_MINUTES}
              invalidText={t("vipMin.invalidDuration")}
              testId="vip-min-after"
            />
          </Question>

          <Question title={t("vipMin.minimum")} hint={t("vipMin.minimumHint")}>
            <DurationInput
              value={minimum}
              onChange={setMinimum}
              disabled={busy}
              label={t("vipMin.minimum")}
              maxMinutes={VIP_MIN_MAX_MINUTES}
              invalidText={t("vipMin.invalidDuration")}
              testId="vip-min-minimum"
            />
          </Question>

          {problem === "vipMin.minimumBelowThreshold" && afterN !== null && minimumN !== null && (
            <span className="error" style={{ fontSize: 12 }}>{fmt(t(problem), d(minimumN), d(afterN))}</span>
          )}
          {problem === "vipMin.scope.none" && (
            <span className="error" style={{ fontSize: 12 }} data-testid="vip-min-no-seats">{t(problem)}</span>
          )}

          {rule && (
            <div className="vip-min-summary">
              {example ? (
                <>
                  {options.length > 1 ? (
                    <label className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="label">{t("vipMin.preview.for")}</span>
                      <select
                        className="input"
                        value={example.key}
                        onChange={(e) => setExampleKey(e.target.value)}
                        style={{ width: "auto" }}
                      >
                        {options.map((o) => <option key={o.key} value={o.key}>{optionText(o)}</option>)}
                      </select>
                    </label>
                  ) : (
                    <span className="label">{fmt(t("vipMin.preview.title"), optionText(example))}</span>
                  )}
                  <VipMinimumChargePreview rule={rule} rate={example.rate} />
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
