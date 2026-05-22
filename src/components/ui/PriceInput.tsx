import { AMD_UNIT, Currency, DEFAULT_RATES, LANG_TO_CURRENCY } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";
import { Lang } from "@/i18n/translations";
import { useEffect, useRef, useState } from "react";

interface Props {
  /** AMD value as a string — canonical storage unit. Same shape the
   *  hourly-rate matrix uses, so submitters always send AMD upstream. */
  value: string;
  /** Emits an AMD string. Empty means "no value typed". */
  onChange: (amdValue: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Short localized suffix for the input gutter. The mapping is locked
 * to the same `LANG_TO_CURRENCY` table the money formatter uses so
 * that the suffix the manager sees is the same currency the player
 * sees on the mobile durationSelect — never out of sync.
 */
const SUFFIX_FOR_LANG: Record<Lang, string> = {
  en: "USD",
  ru: "руб",
  am: AMD_UNIT.am,
};

/**
 * Convert an AMD value (the form's canonical state) to the display
 * value in the user's target currency, at today's static rate. Two
 * decimal places for USD/RUB, whole AMD for the native currency
 * (matches how `moneyDisplay.format` renders AMD elsewhere).
 */
const amdToDisplay = (amdString: string, target: Currency): string => {
  if (amdString === "") return "";
  const amd = Number(amdString);
  if (!Number.isFinite(amd)) return "";
  if (amd === 0) return "0";
  const converted = amd * DEFAULT_RATES[target];
  if (target === "AMD") return Math.round(converted).toString();
  return converted.toFixed(2);
};

/**
 * Convert a typed target-currency value back to AMD for the form
 * state. Math.round prevents floating-point cruft like "4200.0000001"
 * sneaking into the payload that gets sent upstream — AMD is a
 * whole-units currency in this project, fractional drams don't exist
 * in the cashier flow.
 */
const displayToAmd = (target: number, currency: Currency): string => {
  const amd = target / DEFAULT_RATES[currency];
  return Math.round(amd).toString();
};

/**
 * Currency-aware price field. The form state is AMD (the company's
 * base storage currency) but the input renders in whatever currency
 * matches the UI language at today's static rate:
 *
 *   en → USD  ($1,000 stored as 400,000 AMD)
 *   ru → руб  (1,000 руб stored as 4,200 AMD)
 *   am → драм (whole AMD value)
 *
 * Switching language mid-edit converts the displayed value
 * automatically — the manager never sees "1000 AMD" while a Russian
 * player sees "238 руб" for the same row.
 *
 * Input strategy:
 *   - `type="text"` + `inputMode="decimal"` per the existing rule
 *     [[feedback_electron_number_inputs]] — Chromium-Electron
 *     `<input type="number">` swallows keystrokes on this stack.
 *   - Comma is normalised to dot so European keyboards round-trip.
 *   - Round-trip precision is bounded by AMD being a whole-unit
 *     currency: `Math.round` on the AMD side prevents drift on save.
 */
const PriceInput = ({
  value,
  onChange,
  label,
  placeholder = "0",
  required,
  disabled,
  autoFocus,
}: Props) => {
  const { lang } = useLang();
  const target = LANG_TO_CURRENCY[lang];

  const [display, setDisplay] = useState<string>(() => amdToDisplay(value, target));

  // Refs track what we last observed so the sync effect only fires
  // when AMD or target changes EXTERNALLY — not when the user's own
  // keystroke is propagating back through props. Without this guard
  // partial typing like "10." would get reformatted to "10.00" mid-
  // type and strip the trailing dot the user is mid-keystroke on.
  const lastAmdRef = useRef(value);
  const lastTargetRef = useRef(target);

  useEffect(() => {
    if (value === lastAmdRef.current && target === lastTargetRef.current) return;
    lastAmdRef.current = value;
    lastTargetRef.current = target;
    setDisplay(amdToDisplay(value, target));
  }, [value, target]);

  const handleChange = (raw: string) => {
    const cleaned = raw.replace(",", ".");
    if (cleaned !== "" && !/^\d*\.?\d*$/.test(cleaned)) return;
    setDisplay(cleaned);
    if (cleaned === "" || cleaned === ".") {
      lastAmdRef.current = "";
      onChange("");
      return;
    }
    const targetVal = Number(cleaned);
    if (!Number.isFinite(targetVal)) return;
    const amd = displayToAmd(targetVal, target);
    lastAmdRef.current = amd;
    onChange(amd);
  };

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div style={{ position: "relative" }}>
        <input
          className="input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={display}
          onChange={(e) => handleChange(e.target.value)}
          style={{ paddingRight: 56 }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <span
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#9aa8c7",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          {SUFFIX_FOR_LANG[lang]}
        </span>
      </div>
    </div>
  );
};

export default PriceInput;
