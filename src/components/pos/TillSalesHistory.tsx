import { ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { orderRepository } from "@/repositories/OrderRepository";
import { useMemo } from "react";
import { saleCashText, saleItemsText, salePaymentText, saleSellerText } from "./tillSaleText";

/**
 * Products sold on their own — at «Касса» or through «+ Продукт» on the board
 * — in the sales history (2026-10-25).
 *
 * The history showed sessions only, so a juice sold to a guest who never sat
 * down was nowhere an owner could see it beside the evening. Each sale reads as
 * one plain sentence: when, who sold it, what, for how much, how it was paid,
 * what was handed over and given back. The same period and the same person as
 * the page above; the server scopes it (owner: own branches, manager: own
 * branch). Its own loading and error, so the sessions below never wait on it.
 */
interface Props {
  branchId: number;
  fromIso: string;
  toIso: string;
  /** One person's sales, or everyone's. */
  actorId: number | null;
  /** Bumped by the page's Refresh. */
  refreshKey: number;
}

const TillSalesHistory = ({ branchId, fromIso, toIso, actorId, refreshKey }: Props) => {
  const { t, money } = useLang();
  const { data, loading, error, reload } = useAsync(
    () => orderRepository.list({
      branch_id: branchId,
      date_from: fromIso,
      date_to: toIso,
      limit: 1000,
      ...(actorId !== null ? { cashier_user_id: actorId } : {}),
    }),
    [branchId, fromIso, toIso, actorId, refreshKey],
  );

  // What was taken: paid sales only — a voided one is listed, never counted.
  const paid = useMemo(() => (data ?? []).filter((o) => o.status === "paid"), [data]);
  const takings = paid.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <section className="gradient-card till-history" data-testid="till-history">
      <div className="gradient-card-inner col" style={{ gap: 10 }}>
        <div className="row-between" style={{ alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <strong>{t("till.history.title")}</strong>
          {data && data.length > 0 && (
            <span className="muted" data-testid="till-history-total">
              {t("till.history.count").replace("{0}", String(paid.length)).replace("{1}", money(takings))}
            </span>
          )}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{t("till.history.hint")}</span>

        {loading && !data ? (
          <ListSkeleton rows={2} />
        ) : error && !data ? (
          <ErrorState size="compact" error={error} onRetry={() => void reload()} titleKey="till.state.errorTitle" descriptionKey={null} />
        ) : (data ?? []).length === 0 ? (
          <span className="muted" data-testid="till-history-empty">{t("till.history.empty")}</span>
        ) : (
          <div className="list">
            {(data ?? []).map((o) => {
              const seller = saleSellerText(o, t);
              const cash = saleCashText(o, t, money);
              return (
                <div
                  key={o.id}
                  className="list-item till-history__row"
                  style={{ opacity: o.status === "paid" ? 1 : 0.55 }}
                  data-testid="till-history-row"
                >
                  <div className="col" style={{ gap: 2, minWidth: 0 }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {formatDateTime(o.created_at)}
                      {seller ? ` · ${seller}` : ""}
                    </span>
                    <span className="name" style={{ overflowWrap: "anywhere" }}>{saleItemsText(o)}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {salePaymentText(o, t)}
                      {cash ? ` · ${cash}` : ""}
                      {o.status !== "paid" ? ` · ${t("till.voided")}` : ""}
                    </span>
                  </div>
                  <strong style={{ whiteSpace: "nowrap" }}>{money(Number(o.total))}</strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default TillSalesHistory;
