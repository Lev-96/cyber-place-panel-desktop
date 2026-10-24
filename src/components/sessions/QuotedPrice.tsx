import { useLang } from "@/i18n/LanguageContext";
import type { QuoteState } from "./useServerQuote";

/**
 * The server's price for the chosen time, read-only (2026-10-25).
 *
 * An `<output>`, not an input: the figure is computed, never typed, so there
 * is nothing to edit by accident. It shows a figure only when the server has
 * answered for exactly what is chosen — while asking it shows an ellipsis,
 * and on a refusal it shows the reason and NO figure, so an unconfirmed sum
 * never looks final.
 */
interface Props<T> {
  label: string;
  hint: string;
  quote: QuoteState<T>;
  /** The figure out of a quote, null when it carries none. */
  amountOf: (value: T) => number | null;
  /** A note shown under the figure (a waived session's "nothing is charged"). */
  noteOf?: (value: T) => string | null;
}

const QuotedPrice = <T,>({ label, hint, quote, amountOf, noteOf }: Props<T>) => {
  const { t, money } = useLang();
  const value = quote.status === "ok" ? quote.value : null;
  const amount = value === null ? null : amountOf(value);
  const note = value === null || noteOf === undefined ? null : noteOf(value);

  return (
    <div className="quoted-price" data-testid="quoted-price">
      <span className="label">{label}</span>
      <output className="quoted-price__value" aria-live="polite" aria-label={label}>
        {quote.status === "loading"
          ? "…"
          : amount !== null
            ? money(amount)
            : "-"}
      </output>
      <span className="muted quoted-price__hint">{hint}</span>
      {note !== null && <span className="muted quoted-price__hint">{note}</span>}
      {quote.status === "error" && (
        <span className="error quoted-price__hint">{quote.message || t("session.priceUnavailable")}</span>
      )}
    </div>
  );
};

export default QuotedPrice;
