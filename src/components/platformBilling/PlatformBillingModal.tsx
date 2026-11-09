import { apiCompanyInvoices, apiPlatformInvoice } from "@/api/platformBilling";
import Drawer from "@/components/ui/Drawer";
import Pagination from "@/components/ui/Pagination";
import { ListSkeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import type { IPlatformBillingOverview, IPlatformInvoiceDetail } from "@/types/platformBilling";
import { useEffect, useId, useState } from "react";
import { BillingStateBadge } from "./BillingBadges";
import InvoiceDetailBody from "./InvoiceDetailBody";
import { formatBillingDate, percentText, periodText, useBillingMoney } from "./billingFormat";
import { billingSay, monthName } from "./billingSay";

interface Props {
  onClose: () => void;
  /** The company whose invoices to list; null = show the one invoice only. */
  companyId: number | null;
  /** The invoice to open first; null = the open one, else the newest. */
  invoiceId: number | null;
  /** The card's overview, for the running month's estimate (owner card only). */
  overview?: IPlatformBillingOverview | null;
}

const PER_PAGE = 6;

/**
 * «Details» of the Cyber Place Platform bill (owner, 2026-11-09): a panel that
 * slides in from the right and answers at a glance — which month, how much is
 * left to pay, by when, and how the figure came about in one line. The full
 * calculation, payments and history, and the other invoices are there, folded
 * away, for whoever wants them. Opened from the dashboard card and from a
 * payment notice. Mounted only while open.
 */
const PlatformBillingModal = ({ onClose, companyId, invoiceId, overview }: Props) => {
  const { t, lang } = useLang();
  const money = useBillingMoney();
  const titleId = useId();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(invoiceId ?? overview?.open_invoice?.id ?? null);

  const history = useAsync(
    () => (companyId === null ? Promise.resolve(null) : apiCompanyInvoices(companyId, page, PER_PAGE)),
    [companyId, page],
  );
  const rows = history.data?.data ?? [];
  useEffect(() => {
    if (selected === null && rows.length > 0) setSelected(rows[0].id);
  }, [selected, rows]);

  const detail = useAsync<IPlatformInvoiceDetail | null>(
    () => (selected === null ? Promise.resolve(null) : apiPlatformInvoice(selected)),
    [selected],
  );
  const inv = detail.data;

  return (
    <Drawer open onClose={onClose} labelledBy={titleId}>
      <header className="billing-drawer__head">
        <h2 id={titleId} className="billing-drawer__title">
          {inv ? fmt(t("platformBilling.drawer.invoiceFor"), monthName(inv.period_start, lang)) : t("platformBilling.debtTitle")}
        </h2>
        <button type="button" className="billing-drawer__close" onClick={onClose} aria-label={t("platformBilling.drawer.close")} title={t("platformBilling.drawer.close")}>×</button>
      </header>

      <div className="billing-drawer__body" data-invoice-id={inv?.id}>
        {detail.loading && !inv && selected !== null && <SkeletonCard lines={5} />}
        {detail.error && !inv && (
          <ErrorState size="compact" error={detail.error} onRetry={() => void detail.reload()} titleKey="platformBilling.state.errorTitle" descriptionKey={null} />
        )}
        {!inv && selected === null && !history.loading && <p className="muted">{t("platformBilling.drawer.none")}</p>}

        {inv && <InvoiceAtAGlance inv={inv} />}

        {inv && (
          <details className="billing-drawer__fold">
            <summary>{t("platformBilling.drawer.more")}</summary>
            <InvoiceDetailBody invoice={inv} />
          </details>
        )}

        {companyId !== null && rows.length > 1 && (
          <details className="billing-drawer__fold">
            <summary>{t("platformBilling.drawer.others")}</summary>
            {history.loading && !history.data ? (
              <ListSkeleton rows={3} />
            ) : (
              <ul className="billing-history">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`billing-history__row${r.id === selected ? " is-selected" : ""}`}
                      aria-pressed={r.id === selected}
                      onClick={() => setSelected(r.id)}
                    >
                      <span className="billing-history__period">{periodText(r.period_start, r.period_end)}</span>
                      <span className="billing-history__amount">{money(r.amount, r.currency)}</span>
                      <BillingStateBadge state={r.billing_state} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Pagination page={history.data?.meta.current_page ?? page} lastPage={history.data?.meta.last_page ?? 1} onChange={setPage} disabled={history.loading} />
          </details>
        )}

        {overview && (
          <p className="billing-drawer__month">
            {t("platformBilling.card.thisMonth")} <span className="billing-estimate">{t("platformBilling.estimate")}</span>{" "}
            <strong>{money(overview.current_period.commission_amount, overview.currency)}</strong>
            {" · "}{fmt(t("platformBilling.card.rateOfRevenue"), percentText(overview.commission_percent))}
          </p>
        )}
      </div>
    </Drawer>
  );
};

/** The invoice in five seconds: where it stands, what is left, by when, and why that figure. */
const InvoiceAtAGlance = ({ inv }: { inv: IPlatformInvoiceDetail }) => {
  const { t } = useLang();
  const money = useBillingMoney();
  const cur = inv.currency;
  const say = billingSay(t, {
    paid: inv.status === "paid",
    billingState: inv.billing_state,
    daysOverdue: inv.days_overdue,
    access: inv.billing_access,
    dueOn: inv.effective_due_on,
  });

  return (
    <div className="billing-glance">
      <p className={`billing-glance__say billing-glance__say--${say.tone}`} role="status">{say.text}</p>
      <div className="billing-glance__left">
        <span className="billing-glance__label">{t("platformBilling.drawer.left")}</span>
        <span className="billing-glance__amount">{money(inv.balance, cur)}</span>
      </div>
      <dl className="billing-glance__facts">
        <div><dt>{t("platformBilling.charge")}</dt><dd>{money(inv.amount, cur)}</dd></div>
        <div><dt>{t("platformBilling.paid")}</dt><dd>{money(inv.paid_amount, cur)}</dd></div>
        <div><dt>{t("platformBilling.nextDue")}</dt><dd>{formatBillingDate(inv.effective_due_on)}</dd></div>
      </dl>
      <p className="billing-glance__calc">
        {fmt(t("platformBilling.drawer.calc"), money(inv.gross_amount, cur), percentText(inv.commission_percent), money(inv.amount, cur))}
      </p>
    </div>
  );
};

export default PlatformBillingModal;
