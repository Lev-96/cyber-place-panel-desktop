import type { IBillBreakdown } from "@/api/sessions";

type Prepaid = NonNullable<IBillBreakdown["prepaid"]>;

/**
 * The CASH change of a prepaid bill (2026-11-17): the server's `refund.cash`
 * when it says by method — a card refund goes back on the terminal, never out
 * of the drawer — else the whole `change`, which on an all-cash seat is it.
 */
export const prepaidCashChange = (prepaid: Prepaid): number =>
  prepaid.refund ? Number(prepaid.refund.cash ?? 0) : Number(prepaid.change);

interface Props {
  /** The server's `prepaid {amount, change, due}` on this bill. */
  prepaid: Prepaid;
  /**
   * Once the seat is closed: the SERVER's change from the stop (`cash.change`,
   * `Session::cashChange`), which also counts banknotes handed over for a due.
   * Undefined while the receipt is still a preview.
   */
  changeAfterStop?: number;
  t: (k: string) => string;
  money: (n: number) => string;
}

/**
 * A seat paid AHEAD meets its bill (2026-11-15, owner): what was paid at the
 * start, then ONE of three answers, each the server's figure:
 *
 *  - change to give back: the loud one — big, green, `role="status"`, so a
 *    cashier with a queue cannot miss that money goes back to the player;
 *  - still to pay: amber, and the payment below asks only for that;
 *  - paid in full: muted, nothing to do.
 *
 * Nothing is subtracted here.
 */
const PrepaidSettlement = ({ prepaid, changeAfterStop, t, money }: Props) => {
  const change = changeAfterStop ?? prepaidCashChange(prepaid);
  // Paid ahead by card / «Другое» and not all of it used (2026-11-17): it goes
  // back the way it came — said apart from the cash change, so nobody takes
  // card money out of the drawer.
  const cardBack = Number(prepaid.refund?.card ?? 0);
  const otherBack = Number(prepaid.refund?.other ?? 0);
  const anyBack = change > 0 || cardBack > 0 || otherBack > 0;
  const due = changeAfterStop !== undefined ? 0 : Number(prepaid.due);
  return (
    <div className="prepaid-settlement" data-testid="receipt-prepaid">
      <div className="prepaid-settlement__row" data-testid="receipt-prepaid-amount">
        <span>{t("session.prepaid.atStart")}</span>
        <strong>{money(Number(prepaid.amount))}</strong>
      </div>
      {anyBack ? (
        <>
          {change > 0 && (
            <div className="prepaid-change" role="status" data-testid="receipt-prepaid-change">
              <span className="prepaid-change__label">{t("session.prepaid.change")}</span>
              <span className="prepaid-change__figure">{money(change)}</span>
              <span className="prepaid-change__hint">{t("session.prepaid.giveBack")}</span>
            </div>
          )}
          {cardBack > 0 && (
            <div className="prepaid-change" role="status" data-testid="receipt-prepaid-card-refund">
              <span className="prepaid-change__label">{t("session.prepaid.cardRefund")}</span>
              <span className="prepaid-change__figure">{money(cardBack)}</span>
              <span className="prepaid-change__hint">{t("session.prepaid.cardRefundHint")}</span>
            </div>
          )}
          {otherBack > 0 && (
            <div className="prepaid-change" role="status" data-testid="receipt-prepaid-other-refund">
              <span className="prepaid-change__label">{t("session.prepaid.otherRefund")}</span>
              <span className="prepaid-change__figure">{money(otherBack)}</span>
            </div>
          )}
        </>
      ) : due > 0 ? (
        <div className="prepaid-due" data-testid="receipt-prepaid-due">
          <span>{t("session.prepaid.due")}</span>
          <strong>{money(due)}</strong>
        </div>
      ) : (
        <div className="prepaid-full muted" data-testid="receipt-prepaid-full">{t("session.prepaid.paidInFull")}</div>
      )}
    </div>
  );
};

export default PrepaidSettlement;
