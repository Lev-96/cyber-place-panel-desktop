import { ReactNode } from "react";

interface Props {
  /** Shared across the options of one choice — what makes them exclusive. */
  name: string;
  checked: boolean;
  onChange: () => void;
  label?: ReactNode;
  disabled?: boolean;
  /** Extra styles for the wrapping <label>. */
  style?: React.CSSProperties;
}

/**
 * Themed radio — the sibling of {@link Checkbox}, and built the same way for
 * the same reason: a raw `<input type="radio">` renders as the washed-out
 * native control against this dark UI, and the one place it had survived was
 * the minutes/hours choice on a session grant.
 *
 * The real input stays in the DOM (visually hidden) so keyboard navigation,
 * focus and screen readers keep working exactly as the platform intends —
 * arrow keys still move between the options of a group, which a div-with-a-
 * click-handler would have quietly taken away. The neon dot is a purely
 * presentational sibling driven by `data-*` and `:focus-visible`.
 *
 * Single source of truth for the app's radio look. Reuse it; do not hand-roll
 * circles per form.
 */
const Radio = ({ name, checked, onChange, label, disabled, style }: Props) => (
  <label
    className="cp-radio"
    data-checked={checked ? "1" : undefined}
    data-disabled={disabled ? "1" : undefined}
    style={style}
  >
    <input
      type="radio"
      name={name}
      className="cp-radio-input"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    />
    <span className="cp-radio-mark" aria-hidden>
      <span className="cp-radio-dot" />
    </span>
    {label != null && <span className="cp-radio-label">{label}</span>}
  </label>
);

export default Radio;
