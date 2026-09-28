import { ReactNode, useEffect, useRef } from "react";

/**
 * Where ↑/↓ take the highlight in a list of `count` — wrapping at both ends,
 * as SuggestInput and the language picker do. Null for any other key, so the
 * caller leaves that key to its field.
 */
export const stepActive = (key: string, at: number, count: number): number | null => {
  if (count === 0) return null;
  if (key === "ArrowDown") return at >= count - 1 ? 0 : at + 1;
  if (key === "ArrowUp") return at <= 0 ? count - 1 : at - 1;
  return null;
};

/** The DOM id of option `index` in the list `listId` — for `aria-activedescendant`. */
export const optionId = (listId: string, index: number): string => `${listId}-opt-${index}`;

interface Props<T> {
  /** The list's DOM id: the owning field points `aria-controls` at it. */
  id: string;
  options: readonly T[];
  /** A stable, unique key per option — the product id, never its name. */
  optionKey: (option: T) => number | string;
  renderOption: (option: T) => ReactNode;
  /** The highlighted option. Highlighted is not chosen: only `onChoose` chooses. */
  activeIndex: number;
  onActivate: (index: number) => void;
  onChoose: (option: T) => void;
  /** The list's accessible name. */
  label: string;
}

/**
 * The options of a combobox whose FIELD keeps the focus (2026-09-26) — the
 * quick entry's "which product did you mean". The same shape as SuggestInput:
 * the field owns the keys (`stepActive`, Enter, Escape) and points
 * `aria-activedescendant` at `optionId(id, activeIndex)`; this list only
 * shows them. A press on an option never takes the focus from the field
 * (mousedown prevented), hovering moves the highlight, a click chooses —
 * through the same `onChoose` the field's Enter calls.
 */
const OptionList = <T,>({ id, options, optionKey, renderOption, activeIndex, onActivate, onChoose, label }: Props<T>) => {
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  // The highlighted option is always in view — a long list scrolls to it.
  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div id={id} role="listbox" aria-label={label} className="cp-option-list" onMouseDown={(e) => e.preventDefault()}>
      {options.map((option, i) => (
        <div
          key={optionKey(option)}
          id={optionId(id, i)}
          ref={(el) => { optionRefs.current[i] = el; }}
          role="option"
          // ARIA's "selected" in a combobox popup is the highlight (as in
          // SuggestInput); the PICK is only ever made by `onChoose`.
          aria-selected={i === activeIndex}
          className={`cp-option${i === activeIndex ? " is-active" : ""}`}
          onMouseEnter={() => onActivate(i)}
          onClick={() => onChoose(option)}
        >
          {renderOption(option)}
        </div>
      ))}
    </div>
  );
};

export default OptionList;
