import { useLang } from "@/i18n/LanguageContext";
import { billingAccessKey, billingAccessTone, billingStateKey, billingStateTone } from "./billingFormat";

/** The invoice's state as the server computed it ("Overdue", "Paid"…). */
export const BillingStateBadge = ({ state }: { state: unknown }) => {
  const { t } = useLang();
  return (
    <span className={`billing-badge billing-badge--${billingStateTone(state)}`} data-billing-state={String(state ?? "")}>
      {t(billingStateKey(state))}
    </span>
  );
};

/** What the unpaid invoice does to the club's access (full / restricted / suspended). */
export const BillingAccessBadge = ({ access }: { access: unknown }) => {
  const { t } = useLang();
  return (
    <span className={`billing-badge billing-badge--${billingAccessTone(access)}`} data-billing-access={String(access ?? "active")}>
      {t(billingAccessKey(access))}
    </span>
  );
};
