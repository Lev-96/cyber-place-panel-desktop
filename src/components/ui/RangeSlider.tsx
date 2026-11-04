import { useId } from "react";

/**
 * A labelled slider for a bounded number (2026-11-03): the setting's name,
 * its current value written out beside it, and a native range input
 * underneath, so keyboard (arrows, Home / End, Page keys), focus and screen
 * readers work as they do everywhere. The filled part of the track is drawn
 * from the value (`--pct`). Bounds are the caller's: a slider cannot hold a
 * value outside them.
 */
interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** The value as a person reads it ("16 px", "110 %"); also the screen-reader text. */
  format?: (value: number) => string;
  disabled?: boolean;
  testId?: string;
}

const RangeSlider = ({ label, value, min, max, step, onChange, format = String, disabled = false, testId }: Props) => {
  const id = useId();
  const clamped = Math.min(max, Math.max(min, value));
  const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0;
  const text = format(clamped);
  return (
    <div className="cp-range" data-disabled={disabled ? "1" : undefined}>
      <div className="cp-range__head">
        <label htmlFor={id} className="label">{label}</label>
        <output htmlFor={id} className="cp-range__value" aria-hidden>{text}</output>
      </div>
      <input
        id={id}
        type="range"
        className="cp-range__input"
        min={min}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        aria-valuetext={text}
        data-testid={testId}
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
};

export default RangeSlider;
