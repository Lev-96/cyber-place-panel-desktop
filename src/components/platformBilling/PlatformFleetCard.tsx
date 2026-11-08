import { apiAdminInvoicesOrNull } from "@/api/platformBilling";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { useId } from "react";
import { Link } from "react-router-dom";
import { Kv } from "./InvoiceDetailBody";
import { useBillingMoney } from "./billingFormat";

/**
 * The admin's dashboard card (2026-11-09): how much the clubs owe Cyber Place
 * Platform right now, and a way into "Club payments". The figures are the
 * server's totals for the open-invoice list (`totals`); without them only the
 * count of open invoices (the paginator's `total`) is shown — never a sum
 * worked out here. Not drawn at all against a backend without the feature.
 */
const PlatformFleetCard = () => {
  const { t } = useLang();
  const money = useBillingMoney();
  const titleId = useId();
  const { data, loading, error, reload } = useAsync(() => apiAdminInvoicesOrNull({ state: "open", per_page: 1 }), []);

  if (loading && data === null && !error) return <SkeletonCard lines={4} />;
  if (error && !data) {
    return (
      <section className="card platform-debt" aria-labelledby={titleId}>
        <h3 id={titleId} className="platform-debt__title">{t("platformBilling.fleetTitle")}</h3>
        <ErrorState size="compact" error={error} onRetry={() => void reload()} titleKey="platformBilling.state.errorTitle" descriptionKey={null} />
      </section>
    );
  }
  if (!data) return null;

  const totals = data.totals;

  return (
    <section className="card platform-debt" aria-labelledby={titleId} data-testid="platform-fleet-card">
      <header className="platform-debt__head">
        <h3 id={titleId} className="platform-debt__title">{t("platformBilling.fleetTitle")}</h3>
      </header>
      {totals?.balance != null && (
        <div className="platform-debt__total">
          <span className="platform-debt__total-label">{t("platformBilling.fleet.outstanding")}</span>
          <span className="platform-debt__total-value">{money(totals.balance, "AMD")}</span>
        </div>
      )}
      <Kv k={t("platformBilling.fleet.open")} v={String(totals?.count ?? data.meta.total)} />
      <Link to="/platform-billing" className="btn secondary platform-debt__more">
        {t("platformBilling.fleet.openPage")}
      </Link>
    </section>
  );
};

export default PlatformFleetCard;
