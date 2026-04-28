import { useEffect, useRef, useState } from "react";

interface Props {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  /** Fired on blur and on arrow click — use for ajax persistence. */
  onCommit?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places for the up/down arrows. Default 2. */
  precision?: number;
  placeholder?: string;
  disabled?: boolean;
  suffix?: string;
}

const clamp = (n: number, min?: number, max?: number) => {
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
};

const round = (n: number, p: number) => Math.round(n * 10 ** p) / 10 ** p;

const NumberStepper = ({
  label, value, onChange, onCommit,
  min = 0, max = 100, step = 1, precision = 2,
  placeholder, disabled, suffix = "%",
}: Props) => {
  const [text, setText] = useState(String(value ?? 0));
  const lastExternal = useRef(value);

  // Sync from outside (e.g. form reset) without clobbering the user's typing.
  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setText(String(value ?? 0));
    }
  }, [value]);

  const commit = (v: number) => {
    const safe = round(clamp(v, min, max), precision);
    setText(String(safe));
    onChange(safe);
    onCommit?.(safe);
  };

  const onTextChange = (raw: string) => {
    // Allow empty / partial input ("", "1.", "-", "0.5") while typing.
    setText(raw);
    const parsed = parseFloat(raw.replace(",", "."));
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  const onBlur = () => {
    const parsed = parseFloat(text.replace(",", "."));
    if (Number.isFinite(parsed)) commit(parsed);
    else commit(value || min);
  };

  const bump = (dir: 1 | -1) => {
    const cur = parseFloat(text.replace(",", "."));
    const base = Number.isFinite(cur) ? cur : value || 0;
    commit(base + dir * step);
  };

  return (
    <div className="col" style={{ gap: 6 }}>
      {label && <span className="label">{label}</span>}
      <div className="num-stepper">
        <input
          type="text"
          inputMode="decimal"
          className="num-stepper-input"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
        />
        {suffix && <span className="num-stepper-suffix">{suffix}</span>}
        <div className="num-stepper-arrows">
          <button
            type="button"
            className="num-stepper-arrow"
            aria-label="Increase"
            disabled={disabled}
            onClick={() => bump(1)}
          >
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1 7L6 2L11 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="num-stepper-arrow"
            aria-label="Decrease"
            disabled={disabled}
            onClick={() => bump(-1)}
          >
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NumberStepper;
