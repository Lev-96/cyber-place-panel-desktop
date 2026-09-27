import { KeyboardEvent, useRef } from "react";
import Button from "@/components/ui/Button";

export interface SectionTab<K extends string> {
  key: K;
  label: string;
  /** Shown after the label when above zero — how many are chosen there. */
  count?: number;
}

interface Props<K extends string> {
  tabs: readonly SectionTab<K>[];
  value: K;
  onChange: (key: K) => void;
  /** The tab list's accessible name. */
  label: string;
  disabled?: boolean;
}

/**
 * Sections of one screen as tabs (2026-09-27) — «Товары / Доп. предметы» in
 * the Add Product dialog and on the Products screen. The subplatform tabs'
 * look (`.cp-subtabs`, the active one primary), with tab semantics: a
 * `tablist`, `aria-selected`, and ← / → moving between them as a tab strip
 * does. Only the list is here; each screen renders its own panel.
 */
const SectionTabs = <K extends string>({ tabs, value, onChange, label, disabled }: Props<K>) => {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const at = tabs.findIndex((tab) => tab.key === value);
    const next = (at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].key);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div ref={listRef} className="row cp-subtabs" style={{ gap: 6 }} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className="cp-subtab"
            variant={active ? "primary" : "secondary"}
            onClick={() => onChange(tab.key)}
            disabled={disabled}
            title={tab.label}
          >
            {tab.label}{tab.count ? ` · ${tab.count}` : ""}
          </Button>
        );
      })}
    </div>
  );
};

export default SectionTabs;
