import { preciseWhenSmall } from "@/i18n/currency";
import { useLang } from "@/i18n/LanguageContext";
import { ISessionApi } from "@/types/sessions";
import { padChargeOf } from "./joystickView";
import { sessionItemLineTotal } from "./sessionAmount";
import { paymentLabelOf } from "./sessionHistoryModel";

/** A number off the wire: JSON may send "6" for 6. */
const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

interface Props {
  session: ISessionApi;
  /** Stopped or expired: only then are the clock, the total and the payment final. */
  closed: boolean;
}

/**
 * One session's bill on the History card, as a compact table (2026-09-26):
 * one row per thing charged — the play time, each product, the pads — with its
 * quantity, its price and its sum in their own right-aligned columns, the
 * products' subtotal when there are several, then the total and how it was
 * paid. A real <table>, so a screen reader reads it as one.
 *
 * Presentation only. Every figure is computed exactly as before (moved here
 * verbatim from the row): `sessionItemLineTotal` for a line, `padChargeOf` for
 * the pads, the server's `total_paid`, and the clock as that total less the two.
 */
const SessionHistoryBill = ({ session, closed }: Props) => {
  const { t, money } = useLang();
  const items = session.items ?? [];
  const itemsTotal = items.reduce((sum, it) => sum + sessionItemLineTotal(it), 0);
  /**
   * What the extra pads put on this bill.
   *
   * Same shape and same rule as the tile on the board: charged pads only, and
   * a unit price only when every one of them agrees on it. Null on a waived
   * seat and when nothing was charged, because a fee printed under "Free
   * session" is two numbers telling one truth.
   */
  const padCharge = padChargeOf(session);
  const paymentLabel = paymentLabelOf(session, t);
  const total = num(session.total_paid);
  // What the CLOCK earned: the bill less everything that is not the clock.
  //
  // Joysticks used to be left in, so a seat that sold two pads at 500 showed
  // 1000 of them as "time" and the line disagreed with the pad line printed
  // directly beneath it. Subtracted from the same figure the pad line quotes,
  // so the two cannot drift.
  const padTotal = padCharge?.total ?? 0;
  const timeCost = Math.max(0, total - itemsTotal - padTotal);

  if (!closed && items.length === 0 && padCharge === null) return null;

  const perHour = t("session.perHourShort");

  return (
    <section className="hs-bill" aria-label={t("history.billTitle")}>
      <table className="hs-bill__table">
        <caption className="hs-bill__title">{t("history.billTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("history.billItem")}</th>
            <th scope="col" className="mid">{t("history.billQty")}</th>
            <th scope="col" className="mid">{t("history.billPrice")}</th>
            <th scope="col" className="num">{t("history.billSum")}</th>
          </tr>
        </thead>
        <tbody>
          {/* The clock — only once the session is over, when it is a fact. */}
          {closed && <BillRow label={t("history.billTime")} qty={null} price={null} sum={money(timeCost)} />}

          {items.map((it) => (
            <BillRow
              key={it.id}
              label={it.name}
              qty={num(it.qty)}
              // A rented extra's price is a RATE; its sum is the server's figure.
              price={`${money(num(it.price))}${it.is_hourly ? perHour : ""}`}
              sum={money(sessionItemLineTotal(it))}
            />
          ))}
          {/* What the products came to, when there is more than one line to add
              up. Summary rows give their figure the two right-hand columns, so
              a bold total never has to squeeze into one quarter. */}
          {items.length > 1 && (
            <tr className="hs-bill__subtotal">
              <th scope="row" colSpan={2}>{t("history.itemsTotal")}</th>
              <td className="num" colSpan={2}>{money(itemsTotal)}</td>
            </tr>
          )}

          {/* ⚠️ What the pads COST, not how long each was plugged in. The count
              is of CHARGED pads and the sum is `sessionJoysticksTotal` — the
              figure the receipt and the board use. Named by slot, and a unit
              price only when all of them agree on one (a session that straddles
              a re-pricing holds two, and "3 × ?" would be a lie where the sum is
              always true); a rate is marked as one. */}
          {padCharge !== null && (
            <BillRow
              label={t("session.joystickSlot").replace("{0}", padCharge.slots.join(", "))}
              qty={padCharge.count}
              price={padCharge.each !== null ? `${money(padCharge.each)}${padCharge.hourly ? perHour : ""}` : null}
              sum={money(padCharge.total, preciseWhenSmall(padCharge.total))}
            />
          )}
        </tbody>
        {closed && (
          <tfoot>
            <tr className="hs-bill__total">
              <th scope="row" colSpan={2}>{t("history.total")}</th>
              {/* A waived bill reads as the words, not as a zero: "0" could be
                  a session nobody played. */}
              <td className="num" colSpan={2}>{session.is_free ? t("session.freeBill") : money(total)}</td>
            </tr>
            {/* How the money was taken — the value is the bold half. Omitted
                when nothing was recorded: inventing one would be worse than
                the gap. */}
            {paymentLabel !== null && (
              <tr className="hs-bill__pay">
                <th scope="row" colSpan={2}>{t("session.payTitle")}</th>
                <td className="num" colSpan={2}><strong>{paymentLabel}</strong></td>
              </tr>
            )}
          </tfoot>
        )}
      </table>
    </section>
  );
};

/** One line of the bill. A column with nothing to say shows a dash, never a guess. */
const BillRow = ({ label, qty, price, sum }: { label: string; qty: number | null; price: string | null; sum: string }) => (
  <tr>
    <th scope="row">{label}</th>
    <td className="mid">{qty ?? "—"}</td>
    <td className="mid">{price ?? "—"}</td>
    <td className="num">{sum}</td>
  </tr>
);

export default SessionHistoryBill;
