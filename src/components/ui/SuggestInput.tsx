import { InputHTMLAttributes, KeyboardEvent, Ref, useEffect, useId, useRef, useState } from "react";

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "list">;

interface Props extends NativeProps {
  label?: string;
  value: string;
  /** Fired on typing AND on picking a suggestion — one channel for the caller. */
  onValueChange: (value: string) => void;
  /** Candidate values, already ordered by relevance (e.g. most recent first). */
  options: string[];
  /** Show the whole list on focus while the field is still empty. Default true. */
  openOnFocus?: boolean;
  /** When given, each suggestion gets a ✕ that removes it from the source. */
  onRemoveOption?: (value: string) => void;
  removeHint?: string;
  /**
   * Forwarded to the underlying `<input>` so a caller can focus or select the
   * field imperatively. Declared explicitly because this component renders a
   * wrapping `<div>` — without it a `ref` would resolve to the wrapper, not
   * the field. (React 19 passes `ref` as an ordinary prop, so no
   * `forwardRef` is needed.)
   */
  ref?: Ref<HTMLInputElement>;
}

const matches = (option: string, query: string): boolean => {
  const q = query.trim().toLowerCase();
  return q.length === 0 || option.toLowerCase().includes(q);
};

/**
 * Text field with a filtered suggestion dropdown — a generic primitive, not
 * an email-specific one: pass any `options` (recent logins today, branch
 * names or tags tomorrow).
 *
 * Deliberately NOT a native `<datalist>`: its popup is drawn by the OS, so it
 * ignores the app theme, can't render a remove affordance and behaves
 * inconsistently inside Electron.
 *
 * Keyboard: ↓/↑ move (↓ also opens), Enter picks the highlighted option
 * WITHOUT submitting the form, Esc closes but keeps what was typed, Tab
 * leaves. Pointer: mousedown on the list is prevented so the field never
 * blurs before the click is handled.
 */
const SuggestInput = ({
  label,
  value,
  onValueChange,
  options,
  openOnFocus = true,
  onRemoveOption,
  removeHint,
  onKeyDown,
  onFocus,
  onBlur,
  ref,
  ...rest
}: Props) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  const visible = options.filter((o) => matches(o, value));
  const isOpen = open && visible.length > 0;

  // Keep the highlight inside the (possibly shrunk) list as the user types.
  useEffect(() => {
    setHighlight((h) => (h >= visible.length ? visible.length - 1 : h));
  }, [visible.length]);

  // Close when the focus or a click leaves the whole control.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const pick = (option: string) => {
    onValueChange(option);
    setOpen(false);
    setHighlight(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) { setOpen(true); setHighlight(0); return; }
      setHighlight((h) => (h + 1) % visible.length);
      return;
    }
    if (e.key === "ArrowUp") {
      if (!isOpen) return;
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? visible.length - 1 : h - 1));
      return;
    }
    if (e.key === "Enter" && isOpen && highlight >= 0) {
      // Pick the suggestion instead of submitting the surrounding form.
      e.preventDefault();
      pick(visible[highlight]);
      return;
    }
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div ref={boxRef} className="cp-suggest">
      {label && <span className="label">{label}</span>}
      <input
        {...rest}
        ref={ref}
        className="input"
        value={value}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={(e) => {
          onFocus?.(e);
          if (openOnFocus || value.trim()) setOpen(true);
        }}
        onBlur={(e) => {
          onBlur?.(e);
          setOpen(false);
        }}
        onKeyDown={handleKeyDown}
      />

      {isOpen && (
        // mousedown default prevented → the input keeps focus, so `onBlur`
        // can't close the list before the click lands on an option.
        <ul
          id={listId}
          role="listbox"
          className="cp-suggest-list"
          onMouseDown={(e) => e.preventDefault()}
        >
          {visible.map((option, i) => (
            <li key={option} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={`cp-suggest-option${i === highlight ? " is-active" : ""}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(option)}
              >
                {option}
              </button>
              {onRemoveOption && (
                <button
                  type="button"
                  className="cp-suggest-remove"
                  title={removeHint}
                  aria-label={removeHint ? `${removeHint}: ${option}` : undefined}
                  onClick={() => onRemoveOption(option)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SuggestInput;
