import { ReactNode } from "react";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/**
 * Themed on/off switch, for a setting that is a state ("no cover") rather
 * than a list item to tick. Same construction as `Checkbox`: the real input
 * stays in the DOM (visually hidden) with `role="switch"`, so keyboard, focus
 * and screen readers work; the track and thumb are a presentational sibling
 * driven by the `data-*` attributes (styling in `.cp-switch`).
 */
const Switch = ({ checked, onChange, label, disabled, style }: Props) => (
  <label
    className="cp-switch"
    data-checked={checked ? "1" : undefined}
    data-disabled={disabled ? "1" : undefined}
    style={style}
  >
    <input
      type="checkbox"
      role="switch"
      className="cp-switch-input"
      checked={checked}
      aria-checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="cp-switch-track" aria-hidden>
      <span className="cp-switch-thumb" />
    </span>
    {label != null && <span className="cp-switch-label">{label}</span>}
  </label>
);

export default Switch;
