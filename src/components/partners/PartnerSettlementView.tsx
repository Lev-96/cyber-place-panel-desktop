import type { IPartnerSettlement, ISettlementRow } from "@/api/partners";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { branchRepository } from "@/repositories/BranchRepository";
import { partnerRepository } from "@/repositories/PartnerRepository";
import { branchLabel } from "@/components/shifts/ShiftHistory";
import { useId, useState } from "react";
import { monthParam, owedAmount, termsLine } from "./partnerTerms";

const currentMonth = () => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

/**
 * «Расчёт за месяц» (2026-11-18, owner): one card per partner — what their
 * fast food sold, the pieces and the products, «Клубу» and «Партнёру» — and
 * when a fixed sum is more than the month sold, «Партнёр должен клубу X» in
 * plain words. Then the club's own fast food. Every figure is the server's
 * (`/partners/settlement`, the sales history's own count over each branch's
 * working days); nothing is added, split or compared here.
 */
const PartnerSettlementView = ({ companyId }: { companyId: number }) => {
  const { t, money } = useLang();
  const [sel, setSel] = useState(currentMonth);
  const [branchId, setBranchId] = useState<number | null>(null);
  const branchSelectId = useId();
  const month = monthParam(sel);
  const branches = useAsync(() => branchRepository.list({ company_id: companyId }), [companyId]);
  const { data, loading, error, reload } = useAsync(
    () => partnerRepository.settlement(companyId, month, branchId),
    [companyId, month, branchId],
  );
  const m = (v: string) => money(Number(v));

  // The whole period, day by day, as on the revenue screen.
  const period = fmt(
    t("revenue.periodRange"),
    formatDate(new Date(sel.year, sel.month - 1, 1)),
    formatDate(new Date(sel.year, sel.month, 0)),
  );
  const shift = (delta: number) => {
    const d = new Date(sel.year, sel.month - 1 + delta, 1);
    setSel({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };
  const ownBranches = (branches.data ?? []).filter((b) => b.company_id === companyId);

  return (
    <div className="col" style={{ gap: 14 }} data-testid="partner-settlement">
      <div className="revenue-toolbar">
        <div className="month-picker">
          <button className="month-btn" onClick={() => shift(-1)} aria-label={t("revenue.prevMonth")} data-testid="settlement-prev">‹</button>
          <span className="month-label" data-testid="settlement-period">{period}</span>
          <button className="month-btn" onClick={() => shift(1)} aria-label={t("revenue.nextMonth")} data-testid="settlement-next">›</button>
        </div>
        {ownBranches.length > 1 && (
          <div className="revenue-branch-field">
            <label className="label" htmlFor={branchSelectId}>{t("revenue.branch")}</label>
            <select
              id={branchSelectId}
              className="input revenue-branch-select"
              value={branchId ?? ""}
              onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)}
              data-testid="settlement-branch"
            >
              <option value="">{t("revenue.allBranches")}</option>
              {ownBranches.map((b) => (
                <option key={b.id} value={b.id} title={branchLabel(b)}>{branchLabel(b) || `№${b.id}`}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }} data-testid="settlement-note">{t("partners.termsNote")}</p>

      {/* A month or branch being read shows the skeleton, never the previous
          month's figures under the new period. */}
      {loading && <ListSkeleton />}
      {error && !loading && <ErrorState error={error} onRetry={() => void reload()} titleKey="partners.settlementError" />}
      {data && !error && !loading && (
        <>
          <div className="stat-grid">
            <div className="stat-tile" data-testid="settlement-total">
              <span className="k">{t("partners.totalFastFood")}</span>
              <span className="v">{m(data.totals.fast_food_total)}</span>
              <span className="muted sales-card__sub">{fmt(t("sales.productsUnits"), data.totals.fast_food_units)}</span>
            </div>
          </div>
          <div className="settlement-cards">
            {data.partners.map((p) => <PartnerCard key={p.partner.id} p={p} />)}
            <div className="card settlement-card" data-testid="settlement-own">
              <h3 className="settlement-card__title">{t("partners.ownTitle")}</h3>
              <span className="muted">{t("partners.ownHint")}</span>
              <Figure k={t("partners.sold")} v={m(data.own.sales_total)} sub={fmt(t("sales.productsUnits"), data.own.units)} />
              <Rows rows={data.own.rows} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const PartnerCard = ({ p }: { p: IPartnerSettlement }) => {
  const { t, money } = useLang();
  const m = (v: string) => money(Number(v));
  return (
    <div className={`card settlement-card${p.partner_owes ? " is-owes" : ""}`} data-testid={`settlement-partner-${p.partner.id}`}>
      <h3 className="settlement-card__title">
        {p.partner.name}
        {p.partner.archived && <span className="pill partner-row__badge">{t("partners.archivedBadge")}</span>}
      </h3>
      <span className="muted" data-testid="settlement-terms">{termsLine(p.terms, t, money)}</span>
      <Figure k={t("partners.sold")} v={m(p.sales_total)} sub={fmt(t("sales.productsUnits"), p.units)} testId="settlement-sold" />
      <Rows rows={p.rows} />
      <div className="settlement-card__split">
        <Figure k={t("partners.toClub")} v={m(p.club_share)} testId="settlement-club" />
        <Figure k={t("partners.toPartner")} v={m(p.partner_share)} testId="settlement-partner" />
      </div>
      {p.partner_owes && (
        <div className="settlement-card__owes" role="status" data-testid="settlement-owes">
          {fmt(t("partners.owes"), m(owedAmount(p.partner_share)))}
        </div>
      )}
    </div>
  );
};

const Figure = ({ k, v, sub, testId }: { k: string; v: string; sub?: string; testId?: string }) => (
  <div className="settlement-figure" data-testid={testId}>
    <span className="k">{k}</span>
    <strong className="v">{v}</strong>
    {sub && <span className="muted">{sub}</span>}
  </div>
);

const Rows = ({ rows }: { rows: ISettlementRow[] }) => {
  const { t, money } = useLang();
  if (rows.length === 0) return <span className="muted">{t("partners.noSales")}</span>;
  return (
    <ul className="settlement-rows">
      {rows.map((r) => (
        <li key={r.product_id} className="settlement-row">
          <span className="settlement-row__name" title={r.name}>{r.name}</span>
          <span className="muted">× {r.quantity}</span>
          <span>{money(Number(r.total))}</span>
        </li>
      ))}
    </ul>
  );
};

export default PartnerSettlementView;
