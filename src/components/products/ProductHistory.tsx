import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { branchLabel } from "@/components/shifts/ShiftHistory";
import { describeChange } from "@/components/products/productEventChange";
import { useAsync } from "@/hooks/useAsync";
import { formatVenueDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { tr } from "@/i18n/translated";
import { branchRepository } from "@/repositories/BranchRepository";
import { productEventRepository } from "@/repositories/ProductEventRepository";
import { productRepository } from "@/repositories/ProductRepository";
import type { Role } from "@/types/api";
import {
  PRODUCT_ACTIONS, PRODUCT_ACTION_KEY,
  type IProductEvent, type ProductAction, type ProductEventFilters,
} from "@/types/productEvents";
import { useEffect, useMemo, useState } from "react";

/**
 * «История товаров» (2026-11-09): who changed which product, and how — the
 * owner's and the admin's view of the append-only `product_events` trail.
 *
 * Built like the shift history: every filter narrows ONE server request, any
 * change starts again on page 1 (the `{key, page}` idiom), and nothing is
 * filtered in the browser — a long trail is never downloaded to be searched
 * here. The employee and product lists follow the branch and a pick that does
 * not belong to the newly chosen branch is dropped. Which branches an owner
 * may read is the server's answer (StaffBranchScope), so "all branches" is
 * "all of mine".
 *
 * Every figure is the server's: the old and new price are its decimal
 * strings, only formatted here.
 */
interface Props {
  /** The branch the screen was opened from; the filter starts there and can be widened. */
  initialBranchId: number;
}

const PER_PAGE = 20;

const ROLE_KEY: Record<Role, string> = {
  admin: "role.admin",
  company_owner: "role.company_owner",
  manager: "role.manager",
};

const ProductHistory = ({ initialBranchId }: Props) => {
  const { t, money, lang } = useLang();
  const [branchId, setBranchId] = useState<number | undefined>(initialBranchId);
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const [productId, setProductId] = useState<number | undefined>(undefined);
  const [action, setAction] = useState<ProductAction | undefined>(undefined);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const branches = useAsync(() => branchRepository.list(), []);
  const actors = useAsync(
    () => (branchId ? productEventRepository.actors(branchId) : Promise.resolve([])),
    [branchId],
  );
  const products = useAsync(
    () => (branchId ? productRepository.listByBranch(branchId) : Promise.resolve([])),
    [branchId],
  );

  // A pick that is not part of the newly chosen branch is dropped.
  useEffect(() => {
    if (userId === undefined || actors.loading || !actors.data) return;
    if (!actors.data.some((a) => a.id === userId)) setUserId(undefined);
  }, [actors.data, actors.loading, userId]);
  useEffect(() => {
    if (productId === undefined || products.loading || !products.data) return;
    if (!products.data.some((p) => p.id === productId)) setProductId(undefined);
  }, [products.data, products.loading, productId]);

  const filters: ProductEventFilters = useMemo(() => ({
    branch_id: branchId,
    user_id: branchId ? userId : undefined,
    product_id: branchId ? productId : undefined,
    action,
    from: from || undefined,
    to: to || undefined,
  }), [branchId, userId, productId, action, from, to]);

  // Any filter change goes back to page 1, without a reset effect. Empty
  // filters stay undefined: `request()` leaves them out of the query.
  const key = JSON.stringify(filters);
  const [paging, setPaging] = useState({ key, page: 1 });
  const page = paging.key === key ? paging.page : 1;

  const list = useAsync(
    () => productEventRepository.list({ ...filters, page, per_page: PER_PAGE }),
    [key, page],
  );
  const lastPage = list.data?.meta?.last_page ?? 1;

  const active = Number(branchId !== initialBranchId) + Number(userId !== undefined) + Number(productId !== undefined)
    + Number(action !== undefined) + Number(from !== "") + Number(to !== "");
  const reset = () => {
    setBranchId(initialBranchId);
    setUserId(undefined);
    setProductId(undefined);
    setAction(undefined);
    setFrom("");
    setTo("");
  };

  const format = useMemo(() => ({
    price: (amount: string) => money(Number(amount)),
    kind: (kind: string) => t(kind === "additional" ? "product.kindAdditionalShort" : "productHistory.kindRegular"),
  }), [money, t]);

  const actor = (e: IProductEvent) =>
    `${e.actor.name}${e.actor.role ? ` (${t(ROLE_KEY[e.actor.role])})` : ""}`;

  return (
    <div className="col product-history" data-testid="product-history">
      <div className="card product-history-filters">
        <label className="product-history-field">
          <span className="label">{t("productHistory.filter.branch")}</span>
          <select
            className="input"
            value={branchId ?? ""}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : undefined)}
            data-testid="product-history-branch"
          >
            <option value="">{t("productHistory.filter.allBranches")}</option>
            {/* The opened branch stays pickable while the list is still on its way. */}
            {!(branches.data ?? []).some((b) => b.id === initialBranchId) && (
              <option value={initialBranchId}>№{initialBranchId}</option>
            )}
            {(branches.data ?? []).map((b) => <option key={b.id} value={b.id}>{branchLabel(b) || `№${b.id}`}</option>)}
          </select>
        </label>
        <label className="product-history-field">
          <span className="label">{t("productHistory.filter.employee")}</span>
          <select
            className="input"
            value={userId ?? ""}
            disabled={!branchId}
            title={!branchId ? t("productHistory.filter.pickBranchFirst") : undefined}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : undefined)}
            data-testid="product-history-employee"
          >
            <option value="">{branchId ? t("productHistory.filter.allEmployees") : t("productHistory.filter.pickBranchFirst")}</option>
            {(actors.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.role ? `${a.name} (${t(ROLE_KEY[a.role])})` : a.name}</option>
            ))}
          </select>
        </label>
        <label className="product-history-field">
          <span className="label">{t("productHistory.filter.product")}</span>
          <select
            className="input"
            value={productId ?? ""}
            disabled={!branchId}
            title={!branchId ? t("productHistory.filter.pickBranchFirst") : undefined}
            onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : undefined)}
            data-testid="product-history-product"
          >
            <option value="">{branchId ? t("productHistory.filter.allProducts") : t("productHistory.filter.pickBranchFirst")}</option>
            {(products.data ?? []).map((p) => <option key={p.id} value={p.id}>{tr(p, "name", lang)}</option>)}
          </select>
        </label>
        <label className="product-history-field">
          <span className="label">{t("productHistory.filter.action")}</span>
          <select
            className="input"
            value={action ?? ""}
            onChange={(e) => setAction(toAction(e.target.value))}
            data-testid="product-history-action"
          >
            <option value="">{t("productHistory.filter.anyAction")}</option>
            {PRODUCT_ACTIONS.map((a) => <option key={a} value={a}>{t(PRODUCT_ACTION_KEY[a])}</option>)}
          </select>
        </label>
        <label className="product-history-field product-history-field--date">
          <span className="label">{t("productHistory.filter.from")}</span>
          <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} data-testid="product-history-from" />
        </label>
        <label className="product-history-field product-history-field--date">
          <span className="label">{t("productHistory.filter.to")}</span>
          <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} data-testid="product-history-to" />
        </label>
        {active > 0 && (
          <Button variant="secondary" onClick={reset} data-testid="product-history-reset">
            {t("productHistory.filter.reset")} ({active})
          </Button>
        )}
      </div>

      {list.data?.meta && (
        <span className="muted product-history-total" data-testid="product-history-total">
          {t("productHistory.found")}: {list.data.meta.total}
        </span>
      )}

      <StateSwitch
        view={deriveViewState({ loading: list.loading, error: list.error, data: list.data?.data, hasFilters: active > 0 })}
        skeleton={<ListSkeleton />}
        onRetry={() => void list.reload()}
        error={{ titleKey: "productHistory.state.errorTitle" }}
        empty={{ titleKey: "productHistory.state.emptyTitle", descriptionKey: "productHistory.state.emptyDescription" }}
        noResults={{ titleKey: "productHistory.state.noMatchTitle", descriptionKey: "productHistory.state.noMatchDescription" }}
      >
        <div className="list">
          {(list.data?.data ?? []).map((e) => {
            const changes = describeChange(e, format);
            return (
              <div key={e.id} className="list-item product-history-row" data-testid="product-history-row">
                <div className="product-history-body">
                  <div className="name">{e.product_name} · {t(PRODUCT_ACTION_KEY[e.action] ?? e.action)}</div>
                  <div className="meta">
                    {formatVenueDateTime(e.created_at)} · {actor(e)} · {e.branch_name || `№${e.branch_id}`}
                  </div>
                  {changes.map((c, i) => (
                    <div key={c.field ?? i} className="product-history-change" data-testid="product-history-change">
                      {c.field ? `${c.field}: ` : ""}{c.from} → {c.to}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </StateSwitch>

      <Pagination page={page} lastPage={lastPage} onChange={(p) => setPaging({ key, page: p })} disabled={list.loading} />
    </div>
  );
};

const isAction = (v: string): v is ProductAction => PRODUCT_ACTIONS.some((a) => a === v);
const toAction = (v: string): ProductAction | undefined => (isAction(v) ? v : undefined);

export default ProductHistory;
