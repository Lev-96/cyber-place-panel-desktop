import { ReactNode } from "react";

export interface Choice<K extends string | number> {
  key: K;
  /** The line a person reads first ("Игрок брони: Арам"). */
  title: ReactNode;
  /** One quieter line under it ("16:00–17:00 · 077 123 456"). */
  detail?: ReactNode;
  /** A small mark on the right ("Бронь", "Сейчас"). */
  badge?: ReactNode;
  disabled?: boolean;
  /**
   * The row's colour when it means something (2026-11-08): `booked` draws it
   * in the reservation yellow, so a reserved player cannot be mistaken for
   * anybody else at a glance. No tone = the plain row.
   */
  tone?: "booked";
}

interface Props<K extends string | number> {
  /** The group's accessible name. */
  label: string;
  /** Shared by the options; what makes them one choice. */
  name: string;
  choices: readonly Choice<K>[];
  /** Nothing picked yet is allowed: the caller can require a deliberate choice. */
  value: K | null;
  onChange: (key: K) => void;
  disabled?: boolean;
  testId?: string;
}

/**
 * A choice drawn as cards (2026-11-07): each option a large row with a title,
 * a detail line and a badge, the picked one outlined. Built on real radios
 * (visually hidden), so arrows, Tab, focus and screen readers behave as a
 * radio group does. Reuse it for any "pick one of a few" where a dropdown
 * would hide what the options are.
 */
const ChoiceCards = <K extends string | number>({ label, name, choices, value, onChange, disabled = false, testId }: Props<K>) => (
  <div className="choice-cards-list" role="radiogroup" aria-label={label} data-testid={testId}>
    {choices.map((c) => {
      const checked = c.key === value;
      const off = disabled || c.disabled === true;
      return (
        <label
          key={String(c.key)}
          className="choice-card-row"
          data-checked={checked ? "1" : undefined}
          data-disabled={off ? "1" : undefined}
          data-tone={c.tone}
          data-testid={testId ? `${testId}-${c.key}` : undefined}
        >
          <input
            type="radio"
            className="choice-card-row__input"
            name={name}
            checked={checked}
            disabled={off}
            onChange={() => onChange(c.key)}
          />
          <span className="choice-card-row__dot" aria-hidden />
          <span className="choice-card-row__body">
            <span className="choice-card-row__title">{c.title}</span>
            {c.detail && <span className="choice-card-row__detail">{c.detail}</span>}
          </span>
          {c.badge && <span className="choice-card-row__badge">{c.badge}</span>}
        </label>
      );
    })}
  </div>
);

export default ChoiceCards;
