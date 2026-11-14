import { apiGetCompanies } from "@/api/companies";
import { isMissingEndpoint, orFallback } from "@/api/fallback";
import { apiAdminInvoices } from "@/api/platformBilling";
import { BillingAccessBadge, BillingStateBadge } from "@/components/platformBilling/BillingBadges";
import InvoiceActionDialog from "@/components/platformBilling/InvoiceActionDialog";
import InvoiceView from "@/components/platformBilling/InvoiceView";
import { formatBillingDate, percentText, periodText, useBillingMoney } from "@/components/platformBilling/billingFormat";
import type { ActionKind } from "@/components/platformBilling/invoiceActions";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, StateView, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import {
  BILLING_STATES, billingStateOf, type IAdminInvoiceFilters, type IPlatformInvoiceAdminRow, type IPlatformInvoiceSummary,
} from "@/types/platformBilling";
import { useState } from "react";

const PER_PAGE = 20;
/** "open" = every invoice with something left to pay (the server's filter). */
const STATE_FILTERS = ["open", ...BILLING_STATES] as const;

type StateFilter = NonNullable<IAdminInvoiceFilters["state"]>;
/** The select's value, narrowed: "" = all, "open", or a known state. */
const stateFilterOf = (v: string): StateFilter => (v === "open" ? "open" : billingStateOf(v) ?? "");

/**
 * "Club payments" (2026-11-09, admin only): every company's Cyber Place
 * Platform invoices, filtered and paginated by the server; one invoice in full
 * with its journal; and the three writes an admin may make on it — record a
 * payment, an adjustment, a later due date. Each write is confirmed first and
 * the server's answer (or refusal) is shown as it came.
 *
 * Guarded by `menu.platformBilling` here and by the backend on every route.
 */
const PlatformBilling = () => {
  const { t } = useLang();
  const money = useBillingMoney();
  const [state, setState] = useState<StateFilter>("open");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<IPlatformInvoiceSummary | null>(null);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [version, setVersion] = useState(0);
  const [saved, setSaved] = useState(false);

  const list = useAsync(
    () => apiAdminInvoices({ state, company_id: companyId ?? undefined, page, per_page: PER_PAGE }),
    [state, companyId, page, version],
  );
  const companies = useAsync(
    () => orFallback(apiGetCompanies({ per_page: 200 }).then((r) => r.data), []),
    [],
  );

  const rows = list.data?.data ?? [];
  const missing = list.error !== null && isMissingEndpoint(list.error);
  const view = deriveViewState({ loading: list.loading, error: missing ? null : list.error, data: list.data ? rows : null });

  const choose = (row: IPlatformInvoiceAdminRow) => { setSelected(row); setSaved(false); };

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title={t("nav.platformBilling")}>
      {missing ? (
        <StateView variant="empty" size="section" titleKey="platformBilling.admin.missing" descriptionKey={null} />
      ) : (
        <>
          <div className="billing-admin__filters">
            <label className="billing-admin__filter">
              <span className="label">{t("platformBilling.statusLabel")}</span>
              <select className="input" value={state} onChange={(e) => { setState(stateFilterOf(e.target.value)); setPage(1); }}>
                <option value="">{t("platformBilling.admin.allStates")}</option>
                {STATE_FILTERS.map((s) => (
                  <option key={s} value={s}>{t(s === "open" ? "platformBilling.admin.unpaid" : `platformBilling.state.${s}`)}</option>
                ))}
              </select>
            </label>
            <label className="billing-admin__filter">
              <span className="label">{t("label.company")}</span>
              <select
                className="input"
                value={companyId ?? ""}
                onChange={(e) => { setCompanyId(e.target.value ? Number(e.target.value) : null); setPage(1); }}
              >
                <option value="">{t("platformBilling.admin.allStates")}</option>
                {(companies.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="billing-admin">
            <div className="billing-admin__list">
              <StateSwitch
                view={view}
                skeleton={<ListSkeleton rows={6} />}
                size="section"
                onRetry={() => void list.reload()}
                error={{ titleKey: "platformBilling.state.errorTitle" }}
                empty={{ titleKey: "platformBilling.admin.empty", descriptionKey: null }}
              >
                <ul className="billing-admin__rows">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className={`card billing-admin__row${selected?.id === r.id ? " is-selected" : ""}`}
                        aria-pressed={selected?.id === r.id}
                        onClick={() => choose(r)}
                      >
                        <span className="billing-admin__row-head">
                          <span className="billing-admin__company">{r.company_name ?? `№${r.company_id}`}</span>
                          <BillingStateBadge state={r.billing_state} />
                          <BillingAccessBadge access={r.billing_access} />
                        </span>
                        {r.branches && r.branches.length > 0 && (
                          <span className="muted billing-admin__branches">
                            {t("platformBilling.admin.branches")}: {r.branches.map((b) => b.address).join(", ")}
                          </span>
                        )}
                        <span className="billing-admin__figures">
                          <Fig k={t("platformBilling.period")} v={periodText(r.period_start, r.period_end)} />
                          <Fig k={t("platformBilling.percent")} v={percentText(r.commission_percent)} />
                          <Fig k={t("platformBilling.charge")} v={money(r.amount, r.currency)} />
                          <Fig k={t("platformBilling.paid")} v={money(r.paid_amount, r.currency)} />
                          <Fig k={t("platformBilling.balance")} v={money(r.balance, r.currency)} />
                          <Fig k={t("platformBilling.nextDue")} v={formatBillingDate(r.effective_due_on)} />
                          <Fig k={t("platformBilling.daysOverdue")} v={String(r.days_overdue)} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </StateSwitch>
              <Pagination
                page={list.data?.meta.current_page ?? page}
                lastPage={list.data?.meta.last_page ?? 1}
                onChange={setPage}
                disabled={list.loading}
              />
            </div>

            <div className="card billing-admin__detail">
              {selected ? (
                <>
                  <div className="billing-admin__actions">
                    <Button type="button" onClick={() => setAction("payment")}>{t("platformBilling.admin.recordPayment")}</Button>
                    <Button type="button" variant="secondary" onClick={() => setAction("adjustment")}>{t("platformBilling.admin.adjust")}</Button>
                    <Button type="button" variant="secondary" onClick={() => setAction("extend")}>{t("platformBilling.admin.extend")}</Button>
                  </div>
                  {saved && <div className="billing-admin__saved" role="status">{t("platformBilling.admin.saved")}</div>}
                  <InvoiceView key={selected.id} invoiceId={selected.id} version={version} onLoaded={setSelected} />
                </>
              ) : (
                <p className="muted">{t("platformBilling.admin.selectHint")}</p>
              )}
            </div>
          </div>
        </>
      )}

      {action && selected && (
        <InvoiceActionDialog
          kind={action}
          invoice={selected}
          onClose={() => setAction(null)}
          onDone={() => { setAction(null); setSaved(true); setVersion((v) => v + 1); }}
        />
      )}
    </ScreenWithBg>
  );
};

const Fig = ({ k, v }: { k: string; v: string }) => (
  <span className="billing-admin__fig">
    <span className="billing-admin__fig-k">{k}</span>
    <span className="billing-admin__fig-v">{v}</span>
  </span>
);

export default PlatformBilling;
