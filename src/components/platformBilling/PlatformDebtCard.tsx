import { apiPlatformBillingOrNull } from "@/api/platformBilling";
import Button from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { useNotificationsOptional } from "@/notifications/NotificationsContext";
import { useId, useMemo, useState } from "react";
import { BillingAccessBadge, BillingStateBadge } from "./BillingBadges";
import { Kv, overdueText } from "./InvoiceDetailBody";
import PlatformBillingModal from "./PlatformBillingModal";
import { isPlatformBillingNotice } from "./billingNotice";
import { formatBillingDate, percentText, periodText, useBillingMoney } from "./billingFormat";

/**
 * The owner's "Cyber Place Platform: total debt" card (2026-11-09), on the
 * right of the dashboard.
 *
 * Reads `GET /company/{id}/platform-billing` on mount and again whenever a
 * payment notice reaches the feed (a stage, a recorded payment, a restore):
 * the notice is the delta, this read is the truth. Every figure is the
 * server's; the running month is labelled an estimate.
 *
 * A backend without platform billing answers 404: the card is then not drawn
 * at all (nothing on the dashboard changes).
 */
const PlatformDebtCard = ({ companyId }: { companyId: number }) => {
  const { t } = useLang();
  const money = useBillingMoney();
  const titleId = useId();
  const [open, setOpen] = useState(false);

  // The newest payment notice the feed holds: a new one means the bill moved.
  const feed = useNotificationsOptional();
  const lastNotice = useMemo(
    () => feed?.list.find((n) => isPlatformBillingNotice(n))?.id ?? null,
    [feed?.list],
  );

  const { data, loading, error, reload } = useAsync(
    () => apiPlatformBillingOrNull(companyId),
    [companyId, lastNotice],
  );

  if (loading && data === null && !error) return <SkeletonCard lines={5} />;
  if (error && !data) {
    return (
      <section className="card platform-debt" aria-labelledby={titleId}>
        <h3 id={titleId} className="platform-debt__title">{t("platformBilling.debtTitle")}</h3>
        <ErrorState size="compact" error={error} onRetry={() => void reload()} titleKey="platformBilling.state.errorTitle" descriptionKey={null} />
      </section>
    );
  }
  // No platform billing on this server: nothing to show.
  if (!data) return null;

  const inv = data.open_invoice;
  const cur = data.currency;
  const tone = data.days_overdue > 0 ? "danger" : data.billing_state === "due" ? "warn" : "ok";

  return (
    <section className={`card platform-debt platform-debt--${tone}`} aria-labelledby={titleId} data-testid="platform-debt-card">
      <header className="platform-debt__head">
        <h3 id={titleId} className="platform-debt__title">{t("platformBilling.debtTitle")}</h3>
        {data.billing_state && <BillingStateBadge state={data.billing_state} />}
      </header>

      <div className="platform-debt__total">
        <span className="platform-debt__total-label">{t("platformBilling.outstanding")}</span>
        <span className="platform-debt__total-value">{money(data.outstanding_amount, cur)}</span>
        {data.days_overdue > 0 && <span className="billing-danger">{overdueText(t, data.days_overdue)}</span>}
      </div>

      {!inv && <p className="muted platform-debt__none">{t("platformBilling.noDebt")}</p>}
      {inv && <Kv k={t("platformBilling.period")} v={periodText(inv.period_start, inv.period_end)} />}
      {inv && <Kv k={t("platformBilling.charge")} v={money(inv.amount, inv.currency)} />}
      {inv && <Kv k={t("platformBilling.paid")} v={money(inv.paid_amount, inv.currency)} />}
      <Kv k={t("platformBilling.nextDue")} v={formatBillingDate(data.next_due_on)} />
      <Kv k={t("platformBilling.percent")} v={percentText(data.commission_percent)} />
      <Kv
        k={<>{t("platformBilling.currentMonth")} <span className="billing-estimate">{t("platformBilling.estimate")}</span></>}
        v={money(data.current_period.commission_amount, cur)}
      />
      <Kv k={t("platformBilling.accessLabel")} v={<BillingAccessBadge access={data.billing_access} />} />

      <Button type="button" variant="secondary" className="platform-debt__more" onClick={() => setOpen(true)}>
        {t("platformBilling.details")}
      </Button>

      {open && (
        <PlatformBillingModal
          companyId={companyId}
          invoiceId={inv?.id ?? null}
          overview={data}
          onClose={() => { setOpen(false); void reload(); }}
        />
      )}
    </section>
  );
};

export default PlatformDebtCard;
