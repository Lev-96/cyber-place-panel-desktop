import Button from "@/components/ui/Button";
import { ListSkeleton } from "@/components/ui/Skeleton";
import SellProductsDialog from "@/components/pos/SellProductsDialog";
import { useAsync } from "@/hooks/useAsync";
import { formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { orderRepository } from "@/repositories/OrderRepository";
import { IOrder } from "@/types/pos";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

/** Today from midnight, as the server's wall-clock stamp ("YYYY-MM-DD 00:00:00"). */
const startOfToday = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`;
};

const LABEL_KEY: Record<IOrder["payment_method"], string> = {
  cash: "session.payCash",
  card: "session.payCard",
  other: "session.payOther",
  deposit: "till.payDeposit",
};

/**
 * Касса — selling at the counter with no gaming session (2026-09-24).
 *
 * «Продать товар» opens the same basket the session bill uses, paid the way a
 * session is. Below it, today's sales at this till: when, what, who sold it,
 * how it was paid — each one an `orders` row, the till's own record, priced
 * and snapshotted on the server. The day's totals by method sum PAID sales
 * only; a voided one stays listed, marked, and counts for nothing.
 *
 * Open to every staff role at their own branch — the server decides, per
 * branch, exactly as it does for a session's bill.
 */
const Till = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { money, t } = useLang();
  const [selling, setSelling] = useState(false);
  const since = useMemo(startOfToday, []);

  const { data, loading, error, reload } = useAsync(
    () => orderRepository.list({ branch_id: id, date_from: since }),
    [id, since],
  );

  const totals = useMemo(() => {
    const by = new Map<IOrder["payment_method"], number>();
    let all = 0;
    for (const o of data ?? []) {
      if (o.status !== "paid") continue;
      const v = Number(o.total) || 0;
      by.set(o.payment_method, (by.get(o.payment_method) ?? 0) + v);
      all += v;
    }
    return { by, all };
  }, [data]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const paymentOf = (o: IOrder) =>
    o.payment_method === "other" && o.payment_method_other
      ? `${t(LABEL_KEY.other)}: ${o.payment_method_other}`
      : t(LABEL_KEY[o.payment_method]);

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("till.title")} · №{id}</h2>
        <Button onClick={() => setSelling(true)}>{t("till.sell")}</Button>
      </div>

      <div className="card col" style={{ gap: 8 }}>
        <div className="row-between">
          <strong>{t("till.today")}</strong>
          <strong>{money(totals.all)}</strong>
        </div>
        <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
          {(["cash", "card", "other"] as const).map((m) => (
            <span key={m} className="muted" style={{ fontSize: 13 }}>
              {t(LABEL_KEY[m])}: {money(totals.by.get(m) ?? 0)}
            </span>
          ))}
        </div>
      </div>

      {loading && !data && <ListSkeleton />}
      {error && <div className="error">{error.message}</div>}
      {!error && data && data.length === 0 && <div className="muted">{t("till.empty")}</div>}
      {!error && data && data.length > 0 && (
        <div className="list">
          {data.map((o) => (
            <div key={o.id} className="list-item" style={{ opacity: o.status === "paid" ? 1 : 0.5 }}>
              <div style={{ minWidth: 0 }}>
                <div className="name">
                  {(o.items ?? []).map((i) => `${i.product_name} × ${i.quantity}`).join(", ")}
                </div>
                <div className="meta">
                  {formatTime(o.created_at)} · {paymentOf(o)}
                  {o.cashier ? ` · ${o.cashier.name}` : ""}
                  {o.status !== "paid" ? ` · ${t("till.voided")}` : ""}
                </div>
              </div>
              <strong>{money(Number(o.total))}</strong>
            </div>
          ))}
        </div>
      )}

      {selling && (
        <SellProductsDialog
          branchId={id}
          onClose={() => setSelling(false)}
          onSold={() => { void reload(); }}
        />
      )}
    </div>
  );
};

export default Till;
