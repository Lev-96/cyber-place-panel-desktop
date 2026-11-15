import PriceInput from "@/components/ui/PriceInput";
import type { IStartAmountQuote } from "@/api/sessions";
import { fmt } from "@/i18n/translations";
import { durationLabel } from "@/utils/durationLabel";
import type { QuoteState } from "./useServerQuote";

interface Props {
  value: string;
  onChange: (v: string) => void;
  quote: QuoteState<IStartAmountQuote>;
  /** The quote for exactly the sum on screen, or null. */
  quoted: IStartAmountQuote | null;
  money: (n: number) => string;
  t: (k: string) => string;
}

/** 24-hour wall clock, the only format this panel shows a time in. */
const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * «На сумму» in the Start dialog (2026-11-15, owner): the player hands over a
 * sum, the cashier types it, and the SERVER says what it buys — read aloud as
 * one big line, «5 000 ֏ → 5 ч», with the rate and the end under it. Own food
 * is covered first and said so; pads and products are paid on their own.
 * Nothing is worked out here: every figure is the quote's, and a refusal is
 * the server's sentence as it came.
 */
const StartByAmount = ({ value, onChange, quote, quoted, money, t }: Props) => (
  <div className="col start-amount" data-testid="start-amount">
    <PriceInput label={t("session.byAmount.label")} value={value} onChange={onChange} autoFocus />
    {quote.status === "error" && <span className="error" data-testid="start-amount-error">{quote.message}</span>}
    {quoted !== null ? (
      <div className="start-amount__answer">
        <div className="start-amount__result" data-testid="start-amount-result" role="status">
          <span>{money(quoted.amount)}</span>
          <span className="start-amount__arrow" aria-hidden>→</span>
          <span className="start-amount__time">{durationLabel(quoted.minutes, t)}</span>
        </div>
        <span className="start-amount__rate" data-testid="start-amount-rate">
          {fmt(t("session.byAmount.rate"), `${money(quoted.hourly_rate)}${t("session.perHourShort")}`, clock(quoted.ends_at))}
        </span>
        {quoted.outside_food_fee > 0 && (
          <span className="start-amount__rate" data-testid="start-amount-food">
            {fmt(t("session.byAmount.food"), money(quoted.outside_food_fee), money(quoted.time_amount))}
          </span>
        )}
      </div>
    ) : quote.status !== "error" && (
      <span className="muted start-amount__hint">{t("session.byAmount.hint")}</span>
    )}
    <span className="muted start-amount__note" data-testid="start-amount-note">{t("session.byAmount.separate")}</span>
  </div>
);

export default StartByAmount;
