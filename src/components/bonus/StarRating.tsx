import { useLang } from "@/i18n/LanguageContext";

interface Props {
  /** 1–5, or null when not rated. */
  value: number | null;
  /** Absent: shown only. A tap on the current star takes the rating back (null). */
  onChange?: (stars: number | null) => void;
  disabled?: boolean;
  label: string;
  testId?: string;
}

/**
 * Five stars (2026-11-26, owner: clubs and players rate each other). Read
 * only, or a row of five buttons where a tap sets the rating and a tap on the
 * same star takes it back.
 */
const StarRating = ({ value, onChange, disabled = false, label, testId }: Props) => {
  const { t } = useLang();
  const v = value ?? 0;
  return (
    <span className="star-rating" role={onChange ? "radiogroup" : "img"} aria-label={label} title={label} data-testid={testId}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= v;
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={v === n} className={"star-rating__star" + (on ? " is-on" : "")}
            aria-label={t("bonus.rating.star").replace("{0}", String(n))} disabled={disabled}
            onClick={() => onChange(v === n ? null : n)} data-testid={testId ? `${testId}-${n}` : undefined}>★</button>
        ) : (
          <span key={n} className={"star-rating__star" + (on ? " is-on" : "")} aria-hidden="true">★</span>
        );
      })}
    </span>
  );
};

export default StarRating;
