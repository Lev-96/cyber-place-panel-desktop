import NumberStepper from "@/components/ui/NumberStepper";
import { useLang } from "@/i18n/LanguageContext";
import { useState } from "react";
import { CLUB_REASON_UP_TO, COMMENT_MAX, GIFT_FROM, GIFT_MAX } from "./ratingTags";

export interface RateVisitValue { stars: number; comment: string; gift: number }

interface Props {
  value: RateVisitValue;
  onChange: (v: RateVisitValue) => void;
  disabled?: boolean;
  testId?: string;
  /**
   * The most this person may give now (2026-11-28): the owner's caps for a
   * manager; undefined = no cap (the owner). 0 = no gift field at all.
   */
  giftMax?: number;
  /** The line under the gift that says the cap. */
  giftCapHint?: string;
}

const reasonNeeded = (stars: number) => stars >= 1 && stars <= CLUB_REASON_UP_TO;
/** A gift goes only with a good rating (2026-11-27, owner: none at 1–2 stars; the server says the same). */
const giftAllowed = (stars: number) => stars >= GIFT_FROM;

/** Whether the club's rating can be sent: stars, the reason at 1 star, a gift within bounds. */
export const rateVisitReady = (v: RateVisitValue, giftMax: number = GIFT_MAX) =>
  v.stars >= 1 && v.stars <= 5
  && (!reasonNeeded(v.stars) || v.comment.trim() !== "") && v.comment.trim().length <= COMMENT_MAX
  && Number.isFinite(v.gift) && v.gift >= 0 && v.gift <= Math.min(GIFT_MAX, giftMax);

/** What is sent: the reason only at 1 star, the gift only when there is one. */
export const rateVisitBody = (v: RateVisitValue) => ({
  stars: v.stars,
  comment: reasonNeeded(v.stars) ? v.comment.trim() || null : null,
  gift: giftAllowed(v.stars) && v.gift > 0 ? String(v.gift) : null,
});

/**
 * The club rates a player's visit (2026-11-27, owner): big stars and a word
 * for them; at 1 star the reason, required; at 3–5 stars, bonuses as a gift
 * from the club if it wants to give some.
 */
const RateVisitForm = ({ value, onChange, disabled = false, testId = "rate-visit", giftMax, giftCapHint }: Props) => {
  const max = giftMax === undefined ? GIFT_MAX : Math.min(GIFT_MAX, Math.max(0, giftMax));
  const { t } = useLang();
  const [hover, setHover] = useState(0);
  const shown = hover || value.stars;

  return (
    <div className="rate-visit" data-testid={testId}>
      <div className="rate-visit__stars" role="radiogroup" aria-label={t("rating.starsLabel")} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value.stars === n} disabled={disabled}
            className={"rate-visit__star" + (n <= shown ? " is-on" : "")}
            aria-label={t("bonus.rating.star").replace("{0}", String(n))}
            onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(0)}
            onClick={() => onChange({ ...value, stars: n })} data-testid={`${testId}-star-${n}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>
          </button>
        ))}
      </div>
      <div className="rate-visit__caption" aria-live="polite" data-testid={`${testId}-caption`}>
        {shown > 0 ? t(`rating.caption.${shown}`) : t("rating.tapStars")}
      </div>

      {reasonNeeded(value.stars) && (
        <label className="rate-visit__words">
          <span className="label">{t("rating.reason")}<span className="error"> *</span></span>
          <textarea className="input" rows={3} maxLength={COMMENT_MAX} value={value.comment} disabled={disabled}
            placeholder={t("rating.reasonPlaceholder")}
            onChange={(e) => onChange({ ...value, comment: e.target.value })} data-testid={`${testId}-comment`} />
        </label>
      )}

      {giftAllowed(value.stars) && max > 0 && (
        <div className="rate-visit__gift" data-testid={`${testId}-gift`}>
          <span className="rate-visit__gift-icon" aria-hidden="true">🎁</span>
          <div className="rate-visit__gift-text">
            <span className="rate-visit__gift-title">{t("rating.gift")}</span>
            <span className="muted rate-visit__gift-hint">{t("rating.giftHint")}</span>
            {giftCapHint && <span className="muted rate-visit__gift-hint" data-testid={`${testId}-gift-cap`}>{giftCapHint}</span>}
            {value.gift > max && <span className="error rate-visit__gift-hint">{t("rating.giftCapOver")}</span>}
          </div>
          <div className="rate-visit__gift-amount">
            <NumberStepper label={t("rating.giftAmount")} value={value.gift} onChange={(v) => onChange({ ...value, gift: Math.max(0, Math.round(v)) })}
              min={0} max={max} step={100} precision={0} disabled={disabled} suffix="" />
          </div>
        </div>
      )}
    </div>
  );
};

export default RateVisitForm;
