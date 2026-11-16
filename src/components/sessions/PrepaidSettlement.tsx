import type { IBillBreakdown } from "@/api/sessions";

interface Props {
  /** The server's `prepaid {amount, change, due}` on this bill. */
  prepaid: NonNullable<IBillBreakdown["prepaid"]>;
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
  const change = changeAfterStop ?? Number(prepaid.change);
  const due = changeAfterStop !== undefined ? 0 : Number(prepaid.due);
  return (
    <div className="prepaid-settlement" data-testid="receipt-prepaid">
      <div className="prepaid-settlement__row" data-testid="receipt-prepaid-amount">
        <span>{t("session.prepaid.atStart")}</span>
        <strong>{money(Number(prepaid.amount))}</strong>
      </div>
      {change > 0 ? (
        <div className="prepaid-change" role="status" data-testid="receipt-prepaid-change">
          <span className="prepaid-change__label">{t("session.prepaid.change")}</span>
          <span className="prepaid-change__figure">{money(change)}</span>
          <span className="prepaid-change__hint">{t("session.prepaid.giveBack")}</span>
        </div>
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
