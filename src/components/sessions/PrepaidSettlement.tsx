import type { IBillBreakdown } from "@/api/sessions";

type Prepaid = NonNullable<IBillBreakdown["prepaid"]>;

/** How a part was paid ahead, in the receipt's words. */
const WAY_KEY = { cash: "session.payCash", card: "session.payCard", other: "pay.otherShort", bonus: "pay.bonus" } as const;

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
  /**
   * What was owed is already on record (2026-11-22, QA): «Эти товары
   * оплатили?» answered either way — «Да» and «Нет, принять оплату» both
   * record the payment there — or the bill's payment was recorded. The bill
   * then says «Оплачено полностью», never «Доплатить» a second time.
   */
  dueSettled?: boolean;
  /**
   * «Нет, принять оплату» (2026-11-20, owner): the extra was taken at the
   * question — the bill names it, as done («Доплачено 600»), above
   * «Оплачено полностью».
   */
  takenNow?: boolean;
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
const PrepaidSettlement = ({ prepaid, changeAfterStop, dueSettled = false, takenNow = false, t, money }: Props) => {
  const change = changeAfterStop ?? prepaidCashChange(prepaid);
  // Paid ahead by card / «Другое» and not all of it used (2026-11-17): it goes
  // back the way it came — said apart from the cash change, so nobody takes
  // card money out of the drawer.
  const cardBack = Number(prepaid.refund?.card ?? 0);
  const otherBack = Number(prepaid.refund?.other ?? 0);
  // Bonuses paid ahead and not used (2026-11-25): back on the player's Club
  // Card by the server at the Stop — nothing for the cashier to hand over.
  const bonusBack = Number(prepaid.refund?.bonus ?? 0);
  const anyBack = change > 0 || cardBack > 0 || otherBack > 0 || bonusBack > 0;
  const due = changeAfterStop !== undefined || dueSettled ? 0 : Number(prepaid.due);
  return (
    <div className="prepaid-settlement" data-testid="receipt-prepaid">
      <div className="prepaid-settlement__row" data-testid="receipt-prepaid-amount">
        <span>{t("session.prepaid.atStart")}</span>
        <strong>{money(Number(prepaid.amount))}</strong>
      </div>
      {/* How it was paid ahead (QA 2026-11-25): «наличными 698 · бонусами 302»,
          so the change below is plainly the cash part's. Server figures. */}
      {prepaid.by_method && Object.keys(prepaid.by_method).length > 0 && (
        <div className="muted" style={{ fontSize: 13 }} data-testid="receipt-prepaid-ways">
          {(["cash", "card", "other", "bonus"] as const)
            .filter((m) => Number(prepaid.by_method?.[m] ?? 0) > 0)
            .map((m) => `${t(WAY_KEY[m])} ${money(Number(prepaid.by_method![m]))}`).join(" · ")}
        </div>
      )}
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
          {bonusBack > 0 && (
            <div className="prepaid-settlement__row" data-testid="receipt-prepaid-bonus-back">
              <span>{t("session.prepaid.bonusBack")}</span>
              <strong>{money(bonusBack)}</strong>
            </div>
          )}
        </>
      ) : due > 0 ? (
        <div className="prepaid-due" data-testid="receipt-prepaid-due">
          <span>{t("session.prepaid.due")}</span>
          <strong>{money(due)}</strong>
        </div>
      ) : (
        <>
          {takenNow && Number(prepaid.due) > 0 && (
            <div className="prepaid-settlement__row" data-testid="receipt-prepaid-taken">
              <span>{t("session.prepaid.dueTaken")}</span>
              <strong>{money(Number(prepaid.due))}</strong>
            </div>
          )}
          <div className="prepaid-full muted" data-testid="receipt-prepaid-full">{t("session.prepaid.paidInFull")}</div>
        </>
      )}
    </div>
  );
};

export default PrepaidSettlement;
