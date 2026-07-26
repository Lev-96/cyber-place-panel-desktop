import { ReactNode } from "react";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  /** Extra styles for the wrapping <label>. */
  style?: React.CSSProperties;
}

/**
 * Themed checkbox — replaces raw `<input type="checkbox">` (which renders as
 * the washed-out native control against the dark UI). The real input stays in
 * the DOM (visually hidden) so keyboard/focus/accessibility keep working; the
 * neon box is a purely presentational sibling driven by `:checked`/`:disabled`
 * via the `data-*` attributes below. Single source of truth for the app's
 * checkbox look — reuse it, don't hand-roll boxes per form.
 */
const Checkbox = ({ checked, onChange, label, disabled, style }: Props) => (
  <label
    className="cp-checkbox"
    data-checked={checked ? "1" : undefined}
    data-disabled={disabled ? "1" : undefined}
    style={style}
  >
    <input
      type="checkbox"
      className="cp-checkbox-input"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="cp-checkbox-box" aria-hidden>
      <svg viewBox="0 0 16 16" width="11" height="11" className="cp-checkbox-tick">
        <path
          d="M2 8.5l3.5 3.5L14 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
    {label != null && <span className="cp-checkbox-label">{label}</span>}
  </label>
);

export default Checkbox;
