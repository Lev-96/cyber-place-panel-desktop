import { countryByCode, flagOf } from "@/data/countries";

interface Props {
  /** ISO alpha-2 code whose dial prefix is fixed, e.g. "AM" → +374. */
  countryCode: string;
  /** The national part only — never the prefix. A string: a leading 0 stays. */
  value: string;
  onChange: (national: string) => void;
  ariaLabel?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

/**
 * What the number box keeps of anything typed or pasted: its digits, with a
 * leading "+<dial>" or "00<dial>" taken off, so pasting "+374 77 123456" never
 * becomes "+374 +374…". Everything else that is not a digit is dropped.
 */
export const toNationalDigits = (raw: string, dial: string): string => {
  const compact = raw.replace(/[\s().-]+/g, "");
  const rest = compact.startsWith(`+${dial}`)
    ? compact.slice(dial.length + 1)
    : compact.startsWith(`00${dial}`)
      ? compact.slice(dial.length + 2)
      : compact;
  return rest.replace(/\D+/g, "");
};

/**
 * A phone number with a FIXED international prefix (2026-10-11): the prefix
 * is drawn as a non-editable chip next to the box, so it can be neither
 * changed nor typed twice. Used where the country is fixed too (company and
 * branch forms, Armenia); everywhere else keeps its own phone field.
 */
const FixedDialPhoneInput = ({ countryCode, value, onChange, ariaLabel, invalid, describedBy, disabled }: Props) => {
  const dial = countryByCode(countryCode)?.dial ?? "";
  return (
    <div className="row" style={{ gap: 6 }}>
      <span
        className="input fixed-dial"
        data-testid="fixed-dial"
        aria-hidden="true"
        style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, opacity: 0.85, userSelect: "none" }}
      >
        {flagOf(countryCode)} +{dial}
      </span>
      <input
        className="input"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value}
        onChange={(e) => onChange(toNationalDigits(e.target.value, dial))}
        aria-label={ariaLabel ? `${ariaLabel} (+${dial})` : `+${dial}`}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        style={{ flex: 1, minWidth: 0 }}
      />
    </div>
  );
};

export default FixedDialPhoneInput;
