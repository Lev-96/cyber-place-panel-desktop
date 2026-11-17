import { useRef } from "react";

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
  const input = useRef<HTMLInputElement>(null);
  const open = () => {
    const el = input.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  return (
    <span className="date-field" data-testid={testId}>
      <button type="button" className="input date-field__text" onClick={open} aria-label={`${ariaLabel}: ${isoToDisplay(value)}`}>
        {isoToDisplay(value)}
      </button>
      <input
        ref={input}
        type="date"
        className="date-field__native"
        value={value}
        min={min}
        max={max}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
      />
    </span>
  );
};

export default DateField;
