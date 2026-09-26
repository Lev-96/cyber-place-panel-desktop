import { KeyboardEvent, ReactNode, Ref, useEffect, useId, useRef, useState } from "react";

interface Props<T> {
  options: readonly T[];
  /** A stable, unique key per option — the product id, never its name. */
  optionKey: (option: T) => number | string;
  renderOption: (option: T) => ReactNode;
  /** The option currently chosen, or null when nothing is. */
  selectedKey: number | string | null;
  /** `via`: the keyboard's Enter or a pointer's click — a caller may move focus on after the one and not the other. */
  onChoose: (option: T, via: "keyboard" | "pointer") => void;
  /** The list's accessible name. */
  label: string;
  disabled?: boolean;
  /** Escape inside the list: where focus goes back to. Absent → Escape is the dialog's. */
  onEscape?: () => void;
  listRef?: Ref<HTMLDivElement>;
}

/**
 * A single-choice list the keyboard can drive end to end (2026-09-26) — the
 * quick entry's "which product did you mean", and any picker like it.
 *
 * One tab stop: focus sits on the list and `aria-activedescendant` names the
 * highlighted option, so ↑/↓ never walk focus out of the dialog. ↑/↓ wrap, as
 * SuggestInput and the language picker do; Home/End jump to the ends; Enter
 * chooses the highlighted option and nothing else — it never reaches a form
 * or a button. Escape hands focus back (`onEscape`) and, like SuggestInput,
 * prevents its default so the dialog around stays open. A click chooses and
 * puts the focus on the list, so the keys go on working from there.
 */
const OptionList = <T,>({
  options, optionKey, renderOption, selectedKey, onChoose, label, disabled = false, onEscape, listRef,
}: Props<T>) => {
  const id = useId();
  const selectedAt = options.findIndex((o) => optionKey(o) === selectedKey);
  const [active, setActive] = useState(selectedAt >= 0 ? selectedAt : 0);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  // A shorter list (the server's next answer) must not leave the highlight past its end.
  const at = Math.min(active, Math.max(options.length - 1, 0));

  // The highlighted option is always in view — a long list scrolls to it.
  useEffect(() => {
    optionRefs.current[at]?.scrollIntoView?.({ block: "nearest" });
  }, [at]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || options.length === 0) return;
    const last = options.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowDown") next = at >= last ? 0 : at + 1;
    else if (e.key === "ArrowUp") next = at <= 0 ? last : at - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else if (e.key === "Enter") {
      // Chosen here and only here: no submit, no button, no dialog behind.
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) onChoose(options[at], "keyboard");
      return;
    } else if (e.key === "Escape" && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={label}
      aria-activedescendant={options.length > 0 ? `${id}-${at}` : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className="cp-option-list"
      onKeyDown={onKeyDown}
    >
      {options.map((option, i) => {
        const selected = optionKey(option) === selectedKey;
        return (
          <div
            key={optionKey(option)}
            id={`${id}-${i}`}
            ref={(el) => { optionRefs.current[i] = el; }}
            role="option"
            aria-selected={selected}
            className={`cp-option${i === at ? " is-active" : ""}${selected ? " is-selected" : ""}`}
            // The list keeps (or takes) focus, so the keys work after a click.
            onMouseDown={(e) => {
              e.preventDefault();
              (e.currentTarget.parentElement as HTMLElement | null)?.focus();
            }}
            onClick={() => {
              if (disabled) return;
              setActive(i);
              onChoose(option, "pointer");
            }}
          >
            {renderOption(option)}
          </div>
        );
      })}
    </div>
  );
};

export default OptionList;
