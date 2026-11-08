import { apiCompanyInvoices } from "@/api/platformBilling";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import type { IPlatformBillingOverview } from "@/types/platformBilling";
import { useEffect, useId, useState } from "react";
import { BillingStateBadge } from "./BillingBadges";
import { Kv } from "./InvoiceDetailBody";
import InvoiceView from "./InvoiceView";
import { percentText, periodText, useBillingMoney } from "./billingFormat";

interface Props {
  onClose: () => void;
  /** The company whose invoices to list; null = show the one invoice only. */
  companyId: number | null;
  /** The invoice to open first; null = the newest one in the list. */
  invoiceId: number | null;
  /** The card's overview, for the running month's estimate (owner card only). */
  overview?: IPlatformBillingOverview | null;
}

const PER_PAGE = 6;

/**
 * "Details" of the Cyber Place Platform bill: the running month (an estimate),
 * the invoices issued so far (newest first, paginated by the server) and the
 * chosen one in full. Opened from the owner's debt card and from a payment
 * notice. Mounted only while open.
 */
const PlatformBillingModal = ({ onClose, companyId, invoiceId, overview }: Props) => {
  const { t } = useLang();
  const money = useBillingMoney();
  const titleId = useId();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(invoiceId);

  const history = useAsync(
    () => (companyId === null ? Promise.resolve(null) : apiCompanyInvoices(companyId, page, PER_PAGE)),
    [companyId, page],
  );
  const rows = history.data?.data ?? [];

  // Nothing asked for: open the newest invoice the list shows.
  useEffect(() => {
    if (selected === null && rows.length > 0) setSelected(rows[0].id);
  }, [selected, rows]);

  return (
    <Modal open onClose={onClose}>
      <section className="card billing-modal" aria-labelledby={titleId}>
        <h2 id={titleId} className="billing-modal__title">{t("platformBilling.debtTitle")}</h2>

        {overview && (
          <div className="billing-modal__estimate">
            <Kv
              k={<>{t("platformBilling.currentMonth")} <span className="billing-estimate">{t("platformBilling.estimate")}</span></>}
              v={money(overview.current_period.commission_amount, overview.currency)}
            />
            <Kv k={t("platformBilling.period")} v={periodText(overview.current_period.start, overview.current_period.end)} />
            <Kv k={t("platformBilling.base")} v={money(overview.current_period.gross_amount, overview.currency)} />
            <Kv k={t("platformBilling.percent")} v={percentText(overview.commission_percent)} />
            <p className="muted billing-modal__hint">{t("platformBilling.estimateHint")}</p>
          </div>
        )}

        <div className="billing-modal__body">
          {companyId !== null && (
            <div className="billing-modal__history">
              <h3 className="billing-modal__subtitle">{t("platformBilling.invoicesTitle")}</h3>
              {history.loading && !history.data ? (
                <ListSkeleton rows={3} />
              ) : history.error && !history.data ? (
                <ErrorState size="compact" error={history.error} onRetry={() => void history.reload()} titleKey="platformBilling.state.errorTitle" descriptionKey={null} />
              ) : rows.length === 0 ? (
                <p className="muted">{t("platformBilling.noInvoices")}</p>
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
              <Pagination
                page={history.data?.meta.current_page ?? page}
                lastPage={history.data?.meta.last_page ?? 1}
                onChange={setPage}
                disabled={history.loading}
              />
            </div>
          )}

          <div className="billing-modal__detail">
            {selected !== null ? (
              <InvoiceView key={selected} invoiceId={selected} />
            ) : (
              !history.loading && <p className="muted">{t("platformBilling.selectInvoice")}</p>
            )}
          </div>
        </div>
      </section>
    </Modal>
  );
};

export default PlatformBillingModal;
