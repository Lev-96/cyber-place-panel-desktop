interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  /** The short label beside the switch ("Не оплачено"). */
  label: string;
  /** The accessible name ("Доп. время ещё не оплачено"). */
  fullLabel: string;
  disabled?: boolean;
  tabIndex?: number;
  /** Defaults to "unpaid-switch"; a second switch drawn the same way names its own. */
  testId?: string;
  /**
   * The colour it takes when on. "warning" (the default) is amber, something
   * owed; "accent" (2026-11-13, «Свои продукты» in Start) is the panel's accent,
   * a line added to the bill. Same size and construction either way, so two
   * of them side by side read as a pair.
   */
  tone?: "warning" | "accent";
}

/**
 * The «extra time not paid» switch (2026-11-07), in «+ Время» and Start —
 * never on the card (owner). A BUTTON with `role="switch"` drawn as the
 * panel's switch (the `cp-switch` track and thumb); a screen reader hears a
 * switch and its state. Amber when on: something is owed.
 */
const UnpaidToggle = ({
  on, onChange, label, fullLabel, disabled = false, tabIndex, testId = "unpaid-switch", tone = "warning",
}: Props) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={fullLabel}
    title={fullLabel}
    className={["btn unpaid-toggle", tone === "accent" ? "unpaid-toggle--accent" : null, on ? "is-on" : null]
      .filter(Boolean).join(" ")}
    onClick={() => onChange(!on)}
    disabled={disabled}
    tabIndex={tabIndex}
    data-testid={testId}
  >
    <span className="cp-switch-track" aria-hidden>
      <span className="cp-switch-thumb" />
    </span>
    <span className="unpaid-toggle__label">{label}</span>
  </button>
);

export default UnpaidToggle;
