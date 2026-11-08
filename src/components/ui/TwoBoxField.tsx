import { useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { EMPTY_DRAFT, isDraftEmpty, type TwoBoxDraft } from "@/components/sessions/durationModel";

/**
 * Two boxes in one frame, typed like a time field (2026-11-05, owner):
 * "[ 1 ] ч : [ 30 ] мин" for a length, "[ 14 ] : [ 30 ]" for a clock time.
 *
 * Plain text boxes, not `<input type="time">`: Electron swallows keystrokes
 * in raw time/number inputs, and a time input shows the system's AM/PM. What
 * typing means is the caller's rules (`typeIntoHours`, `typeIntoMinutes`,
 * `step`); this owns only the field: the frame and its focus ring, moving on
 * to the minutes when the rules say so, ↑ / ↓, Backspace from empty minutes
 * back to the hours, ×, and saying "invalid" once the field is left — never
 * while it is being typed.
 */
interface Props {
  value: TwoBoxDraft;
  onChange: (next: TwoBoxDraft) => void;
  /** The field's accessible name. */
  label: string;
  /** Whether the value means nothing usable (checked only when not empty). */
  isValid: (d: TwoBoxDraft) => boolean;
  typeIntoHours: (text: string, d: TwoBoxDraft) => { draft: TwoBoxDraft; toMinutes: boolean; wroteMinutes: boolean };
  typeIntoMinutes: (text: string, d: TwoBoxDraft) => TwoBoxDraft;
  step: (d: TwoBoxDraft, box: "hours" | "minutes", dir: 1 | -1) => TwoBoxDraft;
  /** The value written out in full once the field is left ("9" → "09"). */
  settle?: (d: TwoBoxDraft) => TwoBoxDraft;
  /** Accessible names of the two boxes. */
  hoursLabel: string;
  minutesLabel: string;
  /** Units drawn after each box ("ч", "мин"); none for a clock. */
  hoursUnit?: string;
  minutesUnit?: string;
  hoursPlaceholder: string;
  minutesPlaceholder: string;
  clearLabel: string;
  invalidText: string;
  /**
   * The minutes box pads a lone 6…9 with a 0 ("7" → "07", a clock): Backspace
   * at its end then takes the pad with the digit, as it took one key to make.
   */
  padsMinutes?: boolean;
  /** "text" where units may be typed ("1ч 30мин"); "numeric" for a clock. */
  inputMode?: "text" | "numeric";
  disabled?: boolean;
  testId?: string;
}

const TwoBoxField = ({
  value, onChange, label, isValid, typeIntoHours, typeIntoMinutes, step, settle,
  hoursLabel, minutesLabel, hoursUnit, minutesUnit, hoursPlaceholder, minutesPlaceholder,
  clearLabel, invalidText, padsMinutes = false, inputMode = "numeric", disabled = false, testId,
}: Props) => {
  const errorId = useId();
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const empty = isDraftEmpty(value);
  const invalid = !empty && !focused && !isValid(value);

  // A box entered with a value already in it — by a click, Tab, or the move
  // on from the hours onto minutes typed earlier — has that value selected,
  // as a time field does: what is typed next REPLACES it. Left at the end
  // instead, a new "15" was appended to an old "30" and read as 301 minutes
  // (1:30 retyped as 2:15 became 7:15).
  //
  // Minutes the move ITSELF just wrote ("30" typed in the hours is 30 min,
  // "1.5" is 1:30) are the same thing still being typed: the caret goes
  // after them, so the "мин" that follows lands as a unit, not over them.
  //
  // Done at once, never a frame later: a fast typist's first digit would
  // otherwise land before the selection and be replaced by the second.
  const moving = useRef(false);
  // A click that focused a box would collapse the selection on mouse-up.
  const justFocused = useRef(false);

  const toMinutes = (wroteMinutes: boolean) => {
    const box = minutesRef.current;
    if (!box) return;
    moving.current = true;
    box.focus();
    moving.current = false;
    // Kept minutes: selected now. Written ones: the caret after them — said
    // here too, as an unchanged value keeps an old selection through render.
    if (wroteMinutes) box.setSelectionRange(box.value.length, box.value.length);
    else box.select();
  };

  const onBoxFocus = (box: HTMLInputElement) => {
    if (moving.current) return;
    box.select();
    justFocused.current = true;
  };

  const onBoxMouseUp = (e: MouseEvent<HTMLInputElement>) => {
    if (justFocused.current) e.preventDefault();
    justFocused.current = false;
  };

  // A click into the box that already has the focus selects it too, rather
  // than dropping the caret into the middle of "45" for a "5" to make "455".
  const onBoxMouseDown = (e: MouseEvent<HTMLInputElement>) => {
    const box = e.currentTarget;
    if (document.activeElement !== box) return;
    e.preventDefault();
    box.select();
  };

  const onHours = (text: string) => {
    const r = typeIntoHours(text, value);
    onChange(r.draft);
    if (r.toMinutes) toMinutes(r.wroteMinutes);
  };

  const onKey = (box: "hours" | "minutes") => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(step(value, box, e.key === "ArrowUp" ? 1 : -1));
    } else if (padsMinutes && box === "minutes" && e.key === "Backspace" && /^0[6-9]$/.test(e.currentTarget.value)
      && e.currentTarget.selectionStart === 2 && e.currentTarget.selectionEnd === 2) {
      e.preventDefault();
      onChange({ ...value, minutes: "" });
    } else if (box === "minutes" && e.key === "Backspace" && e.currentTarget.value === "") {
      // Back to the hours to go on deleting there: caret at the end, one
      // digit per press, not the whole value selected.
      e.preventDefault();
      const hours = hoursRef.current;
      if (!hours) return;
      moving.current = true;
      hours.focus();
      moving.current = false;
      hours.setSelectionRange(hours.value.length, hours.value.length);
    }
  };

  const boxProps = {
    type: "text",
    inputMode,
    autoComplete: "off",
    spellCheck: false,
    maxLength: 24,
    disabled,
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? errorId : undefined,
  };

  return (
    <div className="two-box">
      <div
        className="two-box__field"
        role="group"
        aria-label={label}
        data-invalid={invalid ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
        data-testid={testId}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setFocused(false);
          if (settle) {
            const settled = settle(value);
            if (settled.hours !== value.hours || settled.minutes !== value.minutes) onChange(settled);
          }
        }}
        // A press on the frame (not on a box) starts at the hours.
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) { e.preventDefault(); hoursRef.current?.focus(); }
        }}
      >
        <input
          {...boxProps}
          ref={hoursRef}
          className="two-box__box"
          value={value.hours}
          placeholder={hoursPlaceholder}
          onChange={(e) => onHours(e.target.value)}
          onKeyDown={onKey("hours")}
          onFocus={(e) => onBoxFocus(e.currentTarget)}
          onMouseUp={onBoxMouseUp}
          onMouseDown={onBoxMouseDown}
          aria-label={hoursLabel}
          data-testid={testId ? `${testId}-hours` : undefined}
        />
        {hoursUnit && <span className="two-box__unit" aria-hidden>{hoursUnit}</span>}
        <span className="two-box__colon" aria-hidden>:</span>
        <input
          {...boxProps}
          ref={minutesRef}
          className="two-box__box"
          value={value.minutes}
          placeholder={minutesPlaceholder}
          onChange={(e) => onChange(typeIntoMinutes(e.target.value, value))}
          onKeyDown={onKey("minutes")}
          onFocus={(e) => onBoxFocus(e.currentTarget)}
          onMouseUp={onBoxMouseUp}
          onMouseDown={onBoxMouseDown}
          aria-label={minutesLabel}
          data-testid={testId ? `${testId}-minutes` : undefined}
        />
        {minutesUnit && <span className="two-box__unit" aria-hidden>{minutesUnit}</span>}
        {!empty && (
          <button
            type="button"
            className="two-box__clear"
            onClick={() => { onChange(EMPTY_DRAFT); hoursRef.current?.focus(); }}
            disabled={disabled}
            aria-label={clearLabel}
            title={clearLabel}
            data-testid={testId ? `${testId}-clear` : undefined}
          >
            ×
          </button>
        )}
      </div>
      {invalid && <span id={errorId} className="error two-box__error">{invalidText}</span>}
    </div>
  );
};

export default TwoBoxField;
