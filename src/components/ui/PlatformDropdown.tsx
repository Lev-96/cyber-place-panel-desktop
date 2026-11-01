import { optionId, stepActive } from "@/components/ui/OptionList";
import { KeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from "react";

export interface DropdownItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  items: readonly DropdownItem[];
  /** The chosen value; "" or one not in `items` shows `placeholder`. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A single-choice dropdown whose options carry an icon — what a native
 * `<select>` cannot draw. A select-only combobox: the button keeps the focus,
 * ↑/↓ move the highlight (`stepActive`, wrapping, the panel's list idiom),
 * Enter / Space choose, Escape and Tab close, a click outside closes. The
 * highlight is announced through `aria-activedescendant`.
 */
const PlatformDropdown = ({ items, value, onChange, ariaLabel, placeholder = "-", disabled, className }: Props) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = items.findIndex((i) => i.value === value);
  const [active, setActive] = useState(Math.max(0, selectedIndex));
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openList = () => {
    if (disabled) return;
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };
  const choose = (item: DropdownItem) => {
    setOpen(false);
    if (item.value !== value) onChange(item.value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }
    const next = stepActive(e.key, active, items.length);
    if (next !== null) { e.preventDefault(); setActive(next); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (items[active]) choose(items[active]); return; }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={rootRef} className={`cp-dropdown${className ? ` ${className}` : ""}`} data-open={open ? "1" : undefined}>
      <button
        type="button"
        className="input cp-dropdown__button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && items[active] ? optionId(listId, active) : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        {selected?.icon}
        <span className="cp-dropdown__value">{selected ? selected.label : placeholder}</span>
        <svg className="cp-dropdown__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div id={listId} role="listbox" aria-label={ariaLabel} className="cp-dropdown__list" onMouseDown={(e) => e.preventDefault()}>
          {items.map((item, i) => (
            <div
              key={item.value}
              id={optionId(listId, i)}
              role="option"
              data-value={item.value}
              aria-selected={item.value === value}
              data-active={i === active ? "1" : undefined}
              className="cp-dropdown__option"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(item)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlatformDropdown;
