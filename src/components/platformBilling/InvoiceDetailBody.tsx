import { formatDateTime } from "@/i18n/dates";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { INVOICE_EVENT_KINDS, PAYMENT_METHODS, type IPlatformInvoiceDetail } from "@/types/platformBilling";
import type { ReactNode } from "react";
import { BillingAccessBadge, BillingStateBadge } from "./BillingBadges";
import { formatBillingDate, percentText, periodText, useBillingMoney } from "./billingFormat";

const KNOWN_EVENTS: readonly string[] = INVOICE_EVENT_KINDS;
const KNOWN_METHODS: readonly string[] = PAYMENT_METHODS;

/**
 * One invoice, printed: the period, the base it was computed on (per source
 * and per branch), the percent, what was charged, every payment and
 * adjustment, the balance, and the journal of what happened to it.
 *
 * Every figure is the server's snapshot, printed as it came — the client adds
 * nothing up. Shared by the owner's "Details" dialog and the admin's page.
 */
const InvoiceDetailBody = ({ invoice: inv }: { invoice: IPlatformInvoiceDetail }) => {
  const { t } = useLang();
  const money = useBillingMoney();
  const cur = inv.currency;
  const extended = inv.effective_due_on && inv.due_on && inv.effective_due_on !== inv.due_on;
  const branches = inv.breakdown ?? [];
  const entries = inv.entries ?? [];
  const events = inv.events ?? [];

  return (
    <div className="invoice-detail" data-invoice-id={inv.id}>
      <div className="invoice-detail__head">
        <span className="invoice-detail__period">{periodText(inv.period_start, inv.period_end)}</span>
        <BillingStateBadge state={inv.billing_state} />
        <BillingAccessBadge access={inv.billing_access} />
      </div>

      <Kv k={t("platformBilling.issuedAt")} v={formatDateTime(inv.issued_at)} />
      <Kv k={t("platformBilling.nextDue")} v={formatBillingDate(inv.effective_due_on)} />
      {extended && <Kv k={t("platformBilling.originalDue")} v={formatBillingDate(inv.due_on)} />}
      {inv.paid_at && <Kv k={t("platformBilling.paidAt")} v={formatDateTime(inv.paid_at)} />}
      {inv.days_overdue > 0 && <Kv k={t("platformBilling.daysOverdue")} v={String(inv.days_overdue)} danger />}

      <h4 className="invoice-detail__section">{t("platformBilling.chargesTitle")}</h4>
      {inv.sessions_amount != null && <Kv k={t("revenue.sourceSessions")} v={money(inv.sessions_amount, cur)} />}
      {inv.pos_amount != null && <Kv k={t("revenue.sourcePos")} v={money(inv.pos_amount, cur)} />}
      {inv.tournaments_amount != null && <Kv k={t("revenue.sourceTournaments")} v={money(inv.tournaments_amount, cur)} />}
      <Kv k={t("platformBilling.base")} v={money(inv.gross_amount, cur)} />
      <Kv k={t("platformBilling.percent")} v={percentText(inv.commission_percent)} />
      <Kv k={t("platformBilling.charge")} v={money(inv.amount, cur)} />
      <Kv k={t("platformBilling.adjustments")} v={money(inv.adjustments_amount, cur)} />
      <Kv k={t("platformBilling.paid")} v={money(inv.paid_amount, cur)} />
      <Kv k={t("platformBilling.balance")} v={money(inv.balance, cur)} highlight />

      {branches.length > 0 && (
        <>
          <h4 className="invoice-detail__section">{t("platformBilling.breakdownTitle")}</h4>
          <div className="invoice-detail__table" role="table">
            <div className="invoice-detail__row invoice-detail__row--head" role="row">
              <span role="columnheader">{t("platformBilling.branchCol")}</span>
              <span role="columnheader">{t("revenue.sourceSessions")}</span>
              <span role="columnheader">{t("revenue.sourcePos")}</span>
              <span role="columnheader">{t("revenue.sourceTournaments")}</span>
              <span role="columnheader">{t("platformBilling.totalCol")}</span>
            </div>
            {branches.map((b) => (
              <div key={b.branch_id} className="invoice-detail__row" role="row">
                <span role="cell" className="invoice-detail__branch">{b.address || `№${b.branch_id}`}</span>
                <span role="cell">{money(b.sessions_amount, cur)}</span>
                <span role="cell">{money(b.pos_amount, cur)}</span>
                <span role="cell">{money(b.tournaments_amount, cur)}</span>
                <span role="cell">{money(b.gross_amount, cur)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h4 className="invoice-detail__section">{t("platformBilling.includedTitle")}</h4>
      <p className="invoice-detail__note">{t("platformBilling.included")}</p>
      <h4 className="invoice-detail__section">{t("platformBilling.excludedTitle")}</h4>
      <p className="invoice-detail__note">{t("platformBilling.excluded")}</p>

      <h4 className="invoice-detail__section">{t("platformBilling.paymentsTitle")}</h4>
      {entries.length === 0 ? (
        <p className="muted invoice-detail__note">{t("platformBilling.noEntries")}</p>
      ) : (
        <ul className="invoice-detail__list">
          {entries.map((e) => (
            <li key={e.id} className="invoice-detail__item">
              <span className="invoice-detail__item-main">
                <span>{t(e.type === "adjustment" ? "platformBilling.entry.adjustment" : "platformBilling.entry.payment")}</span>
                <span className="invoice-detail__amount">{money(e.amount, cur)}</span>
              </span>
              <span className="muted invoice-detail__item-meta">
                {joinMeta(
                  formatDateTime(e.occurred_at),
                  e.method && KNOWN_METHODS.includes(e.method) ? t(`platformBilling.method.${e.method}`) : e.method,
                  e.reference,
                  e.note,
                  e.recorded_by_name,
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {events.length > 0 && (
        <>
          <h4 className="invoice-detail__section">{t("platformBilling.historyTitle")}</h4>
          <ul className="invoice-detail__list">
            {events.map((ev) => (
              <li key={ev.id} className="invoice-detail__item" data-event-kind={ev.kind}>
                <span className="invoice-detail__item-main">
                  <span>{t(KNOWN_EVENTS.includes(ev.kind) ? `platformBilling.event.${ev.kind}` : "platformBilling.event.unknown")}</span>
                </span>
                <span className="muted invoice-detail__item-meta">
                  {joinMeta(formatDateTime(ev.created_at), ev.actor_name ?? t("platformBilling.system"))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const joinMeta = (...parts: Array<string | null | undefined>): string =>
  parts.filter((p): p is string => typeof p === "string" && p.trim() !== "").join(" · ");

export const Kv = ({ k, v, highlight, danger }: { k: ReactNode; v: ReactNode; highlight?: boolean; danger?: boolean }) => (
  <div className="kv-row">
    <span className="k">{k}</span>
    <span className={`v${highlight ? " hi" : ""}${danger ? " billing-danger" : ""}`}>{v}</span>
  </div>
);

/** "Overdue by 3 d." — exported for the cards that say it in one line. */
export const overdueText = (t: (k: string) => string, days: number): string => fmt(t("platformBilling.overdueBy"), days);

export default InvoiceDetailBody;
