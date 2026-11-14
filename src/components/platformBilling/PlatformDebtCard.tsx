import { apiPlatformBillingOrNull } from "@/api/platformBilling";
import Button from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { useNotificationsOptional } from "@/notifications/NotificationsContext";
import { useId, useMemo, useState } from "react";
import { BillingAccessBadge } from "./BillingBadges";
import PlatformBillingModal from "./PlatformBillingModal";
import { isPlatformBillingNotice } from "./billingNotice";
import { formatBillingDate, percentText, useBillingMoney } from "./billingFormat";
import { billingSay } from "./billingSay";
import NavIcon from "@/components/ui/NavIcon";
import { fmt } from "@/i18n/translations";

/**
 * The owner's "Cyber Place Platform: total debt" card (2026-11-09): the full
 * width of the dashboard under the stat tiles, read left to right — what is
 * owed and where that stands, the due date, this month so far, access — and
 * «Details» opening the bill in a panel on the right.
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
  const say = inv
    ? billingSay(t, { paid: false, billingState: data.billing_state, daysOverdue: data.days_overdue, access: data.billing_access, dueOn: data.next_due_on })
    : { text: t("platformBilling.noDebt"), tone: "ok" as const };

  return (
    <section className={`card platform-debt platform-debt--wide platform-debt--${say.tone}`} aria-labelledby={titleId} data-testid="platform-debt-card">
      <div className="platform-debt__main">
        <h3 id={titleId} className="platform-debt__title">
          <NavIcon id="nav.platformBilling" size={20} />
          {t("platformBilling.debtTitle")}
        </h3>
        <span className="platform-debt__label">{t("platformBilling.outstanding")}</span>
        <span className="platform-debt__total-value">{money(data.outstanding_amount, cur)}</span>
        <span className={`platform-debt__say platform-debt__say--${say.tone}`}>{say.text}</span>
      </div>

      <dl className="platform-debt__facts">
        <div className="platform-debt__fact">
          <dt>{t("platformBilling.nextDue")}</dt>
          <dd>{formatBillingDate(data.next_due_on)}</dd>
        </div>
        <div className="platform-debt__fact">
          <dt>{t("platformBilling.card.thisMonth")} <span className="billing-estimate">{t("platformBilling.estimate")}</span></dt>
          <dd>{money(data.current_period.commission_amount, cur)}</dd>
          {/* The rate this month's estimate is worked out at: the company's current one.
              An issued invoice keeps its own (snapshotted) rate, shown in «Details». */}
          <dd className="platform-debt__fact-sub">{fmt(t("platformBilling.card.rateOfRevenue"), percentText(data.commission_percent))}</dd>
        </div>
        <div className="platform-debt__fact">
          <dt>{t("platformBilling.accessLabel")}</dt>
          <dd><BillingAccessBadge access={data.billing_access} /></dd>
        </div>
      </dl>

      <Button type="button" className="platform-debt__more" onClick={() => setOpen(true)}>
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
