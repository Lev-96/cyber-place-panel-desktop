interface Props {
  label?: string;
  value: string;          // "HH:MM"
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}

/**
 * 24-hour text input for HH:MM — explicit alternative to
 * `<input type="time">` whose AM/PM display is dictated by the host
 * OS locale (Windows builds in en-US show 12h regardless of UI
 * language). We render the field as a free text input with strict
 * keystroke validation so the value is always 24-hour, on every
 * platform, regardless of how the user's clock is configured.
 *
 * Input shape:
 *   - exactly five chars: HH:MM
 *   - HH in 00..23, MM in 00..59
 *   - auto-inserts the colon after the second digit so the user
 *     doesn't have to type it
 *
 * Stays purely controlled — the parent owns the value and decides
 * what to do with intermediate / invalid input (we still emit any
 * partial value the user is typing, so the parent's submit-time
 * regex catches malformed entries).
 */
const TimeInput = ({ label, value, onChange, required, disabled }: Props) => {
  const handleChange = (raw: string) => {
    // Strip everything that isn't a digit or a colon. Then auto-
    // insert a colon between hours and minutes so the field reads
    // "13:45" after the user types "1345".
    let cleaned = raw.replace(/[^\d:]/g, "");
    // Limit to a single colon — extra ones get squashed.
    const firstColon = cleaned.indexOf(":");
    if (firstColon >= 0) {
      cleaned = cleaned.slice(0, firstColon + 1) + cleaned.slice(firstColon + 1).replace(/:/g, "");
    }
    // Auto-insert the colon at position 2 when the user types
    // "1245" so they get "12:45" without having to hit the colon
    // key. Skip when they already typed one — the parent's regex
    // catches malformed entries on submit.
    if (cleaned.length >= 3 && !cleaned.includes(":")) {
      cleaned = cleaned.slice(0, 2) + ":" + cleaned.slice(2);
    }
    if (cleaned.length > 5) cleaned = cleaned.slice(0, 5);
    onChange(cleaned);
  };
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <input
        className="input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="HH:MM"
        maxLength={5}
        required={required}
        disabled={disabled}
        pattern="([01]\d|2[0-3]):[0-5]\d"
      />
    </div>
  );
};

export default TimeInput;
