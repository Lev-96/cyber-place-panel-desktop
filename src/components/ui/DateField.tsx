
interface Props {
  /** ISO `YYYY-MM-DD`. */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  ariaLabel: string;
  testId?: string;
}

/** `2026-11-18` → `18.11.2026`; anything else as it is. */
export const isoToDisplay = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

/**
 * A date that always READS `18.11.2026` (2026-11-18, owner: not the OS's
 * `11/18/2026`), and opens the system calendar to pick one. The native
 * `<input type="date">` shows the machine locale's order and cannot be told
 * otherwise, so it stays underneath as the picker only — the value, min and
 * max are its own, unchanged.
 */
const DateField = ({ value, onChange, min, max, ariaLabel, testId }: Props) => {
  /**
   * The real date input lies OVER the text, transparent and full size
   * (2026-11-18, owner: on a phone the calendar did not open): a tap lands on
   * the input itself, so every phone opens its own picker natively — no
   * script call needed, which mobile browsers refuse for a hidden input. On a
   * computer a click on the field's body does not open the calendar by
   * itself, so the click also asks for it (ignored where not supported).
   */
  const open = (el: HTMLInputElement) => {
    try {
      el.showPicker();
    } catch {
      /* the platform opens it on its own (phones), or offers its own button */
    }
  };

  return (
    <span className="date-field" data-testid={testId}>
      <span className="input date-field__text" aria-hidden="true">
        {isoToDisplay(value)}
      </span>
      <input
        type="date"
        className="date-field__native"
        value={value}
        min={min}
        max={max}
        aria-label={`${ariaLabel}: ${isoToDisplay(value)}`}
        onClick={(e) => open(e.currentTarget)}
        onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
      />
    </span>
  );
};

export default DateField;
