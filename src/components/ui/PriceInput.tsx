import { AMD_UNIT } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Currency-suffixed price field — drop-in replacement for the
 * `<Input type="number" />` we used to render in PackageForm and
 * elsewhere. The suffix renders the localized AMD unit ("драм" /
 * "AMD" / "դրамm") right-aligned inside the input gutter so the
 * manager sees the unit without having to read the field label.
 *
 * Input strategy mirrors HourlyRatesForm.PriceInput:
 *   - `type="text"` + `inputMode="decimal"` — the memory rule
 *     [[feedback_electron_number_inputs]] is that Chromium-Electron
 *     `<input type="number">` swallows keystrokes on this stack;
 *     manual digit/decimal validation is safer.
 *   - Comma is normalized to a dot so European keyboards still work
 *     against the numeric `Number(value)` call sites do downstream.
 *
 * SRP: nothing else; styling layout sits in one place so a future
 * switch to USD/RUB only changes the suffix here.
 */
const PriceInput = ({
  label,
  value,
  onChange,
  placeholder = "0",
  required,
  disabled,
  autoFocus,
}: Props) => {
  const { lang } = useLang();
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div style={{ position: "relative" }}>
        <input
          className="input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            const cleaned = e.target.value.replace(",", ".");
            // Whitelist digits + a single decimal separator. Letters
            // and double-dots silently drop — same UX type="number"
            // tries to give us but consistent across hosts.
            if (cleaned !== "" && !/^\d*\.?\d*$/.test(cleaned)) return;
            onChange(cleaned);
          }}
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
          {AMD_UNIT[lang]}
        </span>
      </div>
    </div>
  );
};

export default PriceInput;
