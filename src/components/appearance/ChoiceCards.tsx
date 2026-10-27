import type { ReactNode } from "react";

/**
 * A set of large, labelled choices, one of which is on (2026-10-27): a
 * radio group a newcomer can read — a name, one sentence of what it means, an
 * optional picture — rather than a dropdown of terms. Keyboard: Tab to the
 * group, arrows / Space like any radio group (native inputs underneath).
 */
export interface Choice<K extends string> {
  key: K;
  title: string;
  description?: string;
  picture?: ReactNode;
}

interface Props<K extends string> {
  name: string;
  /** The group's accessible name. */
  label: string;
  value: K;
  choices: ReadonlyArray<Choice<K>>;
  onChange: (key: K) => void;
  disabled?: boolean;
}

const ChoiceCards = <K extends string>({ name, label, value, choices, onChange, disabled = false }: Props<K>) => (
  <div className="choice-cards" role="radiogroup" aria-label={label}>
    {choices.map((c) => (
      <label key={c.key} className={`choice-card${value === c.key ? " is-on" : ""}`} data-testid={`choice-${name}-${c.key}`}>
        <input
          type="radio"
          name={name}
          value={c.key}
          checked={value === c.key}
          disabled={disabled}
          onChange={() => onChange(c.key)}
          className="choice-card__input"
        />
        {c.picture && <span className="choice-card__picture" aria-hidden>{c.picture}</span>}
        <span className="choice-card__title">{c.title}</span>
        {c.description && <span className="choice-card__desc">{c.description}</span>}
      </label>
    ))}
  </div>
);

export default ChoiceCards;
