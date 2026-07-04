import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { orderRepository } from "@/repositories/OrderRepository";
import { IOrder } from "@/types/pos";
import { useMemo, useState } from "react";

/** Local "YYYY-MM-DDTHH:mm" — what `<input type="datetime-local">` reads/writes. */
const toLocalInput = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Turn a local datetime-local value into the wall-clock "YYYY-MM-DD HH:mm:ss"
 * the backend compares against `orders.created_at`. The column stores app-tz
 * (Asia/Yerevan) wall-clock literals, and the cashier's machine runs the same
 * tz — so the picked instant matches the column with no offset math. `end`
 * widens to :59 so the chosen minute is fully included.
 */
const toServerStamp = (local: string, side: "start" | "end"): string =>
  local ? `${local.replace("T", " ")}:${side === "start" ? "00" : "59"}` : "";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const PosHistory = ({ branchId }: { branchId: number }) => {
  const { t, money } = useLang();

  // Default window: from start of today → now.
  const defaults = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: toLocalInput(start), to: toLocalInput(now) };
  }, []);
  const [from, setFrom] = useState<string>(defaults.from);
  const [to, setTo] = useState<string>(defaults.to);

  const dateFrom = useMemo(() => toServerStamp(from, "start"), [from]);
  const dateTo = useMemo(() => toServerStamp(to, "end"), [to]);

  const { data, loading, error, reload } = useAsync(
    () => orderRepository.list({ branch_id: branchId, date_from: dateFrom, date_to: dateTo }),
    [branchId, dateFrom, dateTo],
  );

  const orders = data ?? [];
  const summary = useMemo(() => {
    const revenue = orders
      .filter((o) => o.status === "paid")
      .reduce((s, o) => s + num(o.total), 0);
    return { count: orders.length, revenue };
  }, [orders]);

  const setRange = (kind: "today" | "yesterday" | "month") => {
    const now = new Date();
    const start = new Date(now);
    if (kind === "today") {
      start.setHours(0, 0, 0, 0);
      setFrom(toLocalInput(start));
      setTo(toLocalInput(now));
    } else if (kind === "yesterday") {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 0, 0);
      setFrom(toLocalInput(start));
      setTo(toLocalInput(end));
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      setFrom(toLocalInput(start));
      setTo(toLocalInput(now));
    }
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="gradient-card">
        <div className="gradient-card-inner">
          <div className="row" style={{ gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="col" style={{ gap: 4 }}>
              <span className="label">{t("history.from")}</span>
              <input type="datetime-local" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input" />
            </div>
            <div className="col" style={{ gap: 4 }}>
              <span className="label">{t("history.to")}</span>
              <input type="datetime-local" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input" />
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="pill" onClick={() => setRange("today")}>{t("history.today")}</button>
              <button type="button" className="pill" onClick={() => setRange("yesterday")}>{t("history.yesterday")}</button>
              <button type="button" className="pill" onClick={() => setRange("month")}>{t("history.month")}</button>
              <button type="button" className="pill" onClick={() => void reload()}>{t("action.refresh")}</button>
            </div>
          </div>

          <div className="stat-grid" style={{ marginTop: 12 }}>
            <Tile k={t("pos.histCount")} v={String(summary.count)} />
            <Tile k={t("pos.histSum")} v={money(summary.revenue)} />
          </div>
        </div>
      </div>

      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        orders.length === 0
          ? <div className="muted">{t("pos.histEmpty")}</div>
          : <div className="col" style={{ gap: 8 }}>{orders.map((o) => <OrderRow key={o.id} order={o} />)}</div>
      )}
    </div>
  );
};

const OrderRow = ({ order }: { order: IOrder }) => {
  const { t, money } = useLang();
  const voided = order.status === "voided";
  const items = order.items ?? [];
  const cashier = order.cashier;
  const roleLabel = cashier ? t(`role.${cashier.role}`) : "";

  return (
    <div className="card col" style={{ gap: 6, opacity: voided ? 0.6 : 1 }}>
      <div className="row-between" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
          <strong style={{ fontSize: 15, color: "#07ddf1" }}>#{order.id}</strong>
          <span className="pill" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}>{t("pos.cash")}</span>
          <span className="pill" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}>
            {voided ? t("pos.statusVoided") : t("pos.statusPaid")}
          </span>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{formatDateTime(order.created_at)}</span>
      </div>

      {/* Who charged the money, in what role, on which shift — so the owner
          can attribute every cash movement to a concrete employee + shift. */}
      <div className="muted" style={{ fontSize: 12 }}>
        {t("pos.cashier")}: {cashier
          ? <strong style={{ fontWeight: 600, color: "#cdd7ee" }}>{cashier.name}{roleLabel ? ` · ${roleLabel}` : ""}</strong>
          : "—"}
        {order.cashier_shift_id ? ` · ${t("pos.shift")} №${order.cashier_shift_id}` : ""}
      </div>

      {items.length > 0 && (
        <div className="col" style={{ gap: 2, marginTop: 2 }}>
          {items.map((it) => (
            <div key={it.id} className="row-between" style={{ fontSize: 13 }}>
              <span>{it.product_name} {it.quantity > 1 && <span className="muted">× {it.quantity}</span>}</span>
              <span>{money(num(it.line_total))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="row-between" style={{ borderTop: "1px solid #1f2a44", paddingTop: 6, marginTop: 2, fontSize: 15, fontWeight: 700 }}>
        <span>{t("pos.total")}</span>
        <span style={{ textDecoration: voided ? "line-through" : "none" }}>{money(num(order.total))}</span>
      </div>
    </div>
  );
};

const Tile = ({ k, v }: { k: string; v: string }) => (
  <div className="stat-tile">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
  </div>
);

export default PosHistory;
