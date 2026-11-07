interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  /** The short label beside the switch ("Не оплачено"). */
  label: string;
  /** The accessible name ("Доп. время ещё не оплачено"). */
  fullLabel: string;
  disabled?: boolean;
  tabIndex?: number;
}

/**
 * The card's «extra time not paid» switch (2026-11-07). A BUTTON with
 * `role="switch"` drawn as the panel's switch (the `cp-switch` track and
 * thumb), not a checkbox: the card's controls are buttons — the appearance
 * preview draws them inert, with no inputs in it — and a screen reader still
 * hears a switch and its state. Amber when on: something is owed.
 */
const UnpaidToggle = ({ on, onChange, label, fullLabel, disabled = false, tabIndex }: Props) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={fullLabel}
    title={fullLabel}
    className={on ? "btn unpaid-toggle is-on" : "btn unpaid-toggle"}
    onClick={() => onChange(!on)}
    disabled={disabled}
    tabIndex={tabIndex}
    data-testid="unpaid-switch"
  >
    <span className="cp-switch-track" aria-hidden>
      <span className="cp-switch-thumb" />
    </span>
    <span className="unpaid-toggle__label">{label}</span>
  </button>
);

export default UnpaidToggle;
