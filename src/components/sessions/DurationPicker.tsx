import SectionTabs from "@/components/ui/SectionTabs";
import { useLang } from "@/i18n/LanguageContext";
import { MAX_DURATION_MINUTES, amountIn, minutesOf, presetsOf, type DurationUnit } from "./durationModel";

/**
 * Hours ↔ minutes, a preset or a typed value (2026-10-25).
 *
 * Used by "+ Время" and by a planned start, so both read a length the same
 * way. ONE amount and ONE unit: a preset writes into the same box a cashier
 * types into, and switching the unit rewrites the box in the new unit
 * (2 h → 120 min) rather than re-reading "2" as two minutes.
 *
 * The box is text with `inputMode`, the mechanism `NumberStepper` uses —
 * Electron swallows keystrokes in a raw `type="number"`. Empty is "not filled
 * in yet", which is not an error and is not shouted at.
 */
interface Props {
  unit: DurationUnit;
  amount: string;
  onChange: (next: { unit: DurationUnit; amount: string }) => void;
  disabled?: boolean;
  /** The box's accessible name. */
  label: string;
  /** Quick picks per unit; default the session ones (`presetsOf`). */
  presets?: Record<DurationUnit, readonly number[]>;
  /** The longest length accepted; default the session ceiling (600 min). */
  maxMinutes?: number;
  /** Said under a value that is not accepted; default `session.timeInvalid`. */
  invalidText?: string;
}

const DurationPicker = ({
  unit,
  amount,
  onChange,
  disabled = false,
  label,
  presets,
  maxMinutes = MAX_DURATION_MINUTES,
  invalidText,
}: Props) => {
  const { t } = useLang();
  const suffix = unit === "hours" ? t("time.hourShort") : t("time.minShort");
  const minutes = minutesOf(amount, unit, maxMinutes);

  return (
    <div className="col duration-picker" style={{ gap: 8 }}>
      <SectionTabs
        label={t("session.durationUnit")}
        value={unit}
        disabled={disabled}
        tabs={[
          { key: "hours", label: t("session.timeUnitHours") },
          { key: "minutes", label: t("session.timeUnitMinutes") },
        ]}
        onChange={(next) => onChange({ unit: next, amount: amountIn(amount, unit, next, maxMinutes) })}
      />

      <div className="duration-picker__presets" role="group" aria-label={t("session.durationPresets")}>
        {(presets ? presets[unit] : presetsOf(unit)).map((n) => {
          const chosen = minutes !== null && minutesOf(String(n), unit, maxMinutes) === minutes;
          return (
            <button
              key={n}
              type="button"
              className={`btn secondary duration-picker__preset${chosen ? " is-on" : ""}`}
              aria-pressed={chosen}
              disabled={disabled}
              onClick={() => onChange({ unit, amount: String(n) })}
            >
              {n} {suffix}
            </button>
          );
        })}
      </div>

      <label className="row" style={{ gap: 8, alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 12 }}>{t("session.durationCustom")}</span>
        <input
          className="input"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onChange({ unit, amount: e.target.value })}
          aria-label={label}
          disabled={disabled}
          style={{ width: 96 }}
        />
        <span className="muted" style={{ fontSize: 12 }}>{suffix}</span>
      </label>

      {amount.trim() !== "" && minutes === null && (
        <span className="error" style={{ fontSize: 12 }}>{invalidText ?? t("session.timeInvalid")}</span>
      )}
    </div>
  );
};

export default DurationPicker;
