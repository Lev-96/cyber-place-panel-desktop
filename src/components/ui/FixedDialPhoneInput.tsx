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
  // ONE control, drawn like any `.input`: a compact grey prefix that is
  // plainly not editable, then the number box inside the same frame. The
  // prefix is text, not a field — nothing can focus, select or change it.
  return (
    <div className={`phone-group${invalid ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}`}>
      <span className="phone-group__dial" data-testid="fixed-dial" aria-hidden="true">
        <span className="phone-group__flag">{flagOf(countryCode)}</span>+{dial}
      </span>
      <input
        className="phone-group__number"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value}
        onChange={(e) => onChange(toNationalDigits(e.target.value, dial))}
        aria-label={ariaLabel ? `${ariaLabel} (+${dial})` : `+${dial}`}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        aria-required="true"
        disabled={disabled}
      />
    </div>
  );
};

export default FixedDialPhoneInput;
