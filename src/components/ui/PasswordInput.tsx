import { InputHTMLAttributes, forwardRef, useState } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/**
 * Password field with a show/hide (eye) toggle. Single source of truth for
 * password entry — reuse everywhere a password is typed instead of a raw
 * `<Input type="password">`, so the reveal affordance is consistent. Accepts
 * the same props as Input (label + input attributes); `style` is merged so
 * callers can still pass e.g. a red border for a validation error.
 */
const PasswordInput = forwardRef<HTMLInputElement, Props>(({ label, style, ...rest }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div style={{ position: "relative" }}>
        <input
          ref={ref}
          className="input"
          type={show ? "text" : "password"}
          {...rest}
          style={{ ...style, paddingRight: 42 }}
        />
        <button
          type="button"
          className="pw-eye"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
});

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
