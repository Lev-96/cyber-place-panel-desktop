import { useAuth } from "@/auth/AuthContext";
import PosHistory from "@/components/pos/PosHistory";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { fmt as msgFmt } from "@/i18n/translations";
import { orderRepository } from "@/repositories/OrderRepository";
import { productRepository } from "@/repositories/ProductRepository";
import { CartLine, IProduct } from "@/types/pos";
import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

type PosView = "terminal" | "history";

const PosTerminal = () => {
  const { branchId } = useParams();
  const { t } = useLang();
  const { user } = useAuth();
  const id = Number(branchId);
  const [view, setView] = useState<PosView>("terminal");

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("error.invalidBranchId")}</div>;

  // A manager may only operate the POS for their OWN branch. If they land on
  // another branch's terminal (stale link / manual URL), bounce them to
  // theirs so the sale is never started — let alone booked — against the
  // wrong venue. The backend enforces the same rule on every order write.
  const myBranchId = user?.role === "manager" ? user.dashboard?.branch_id ?? null : null;
  if (myBranchId != null && myBranchId !== id) {
    return <Navigate to={`/branches/${myBranchId}/pos`} replace />;
  }

  return (
    <div className="col" style={{ gap: 14, height: "100%" }}>
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <h2 className="page-title" style={{ margin: 0 }}>{t("pos.title")} · №{id}</h2>
        <div className="row" style={{ gap: 6, marginLeft: "auto" }}>
          <Button variant={view === "terminal" ? "primary" : "secondary"} onClick={() => setView("terminal")}>{t("pos.terminalTab")}</Button>
          <Button variant={view === "history" ? "primary" : "secondary"} onClick={() => setView("history")}>{t("pos.historyTab")}</Button>
        </div>
      </div>

      {view === "terminal" ? <Terminal branchId={id} /> : <PosHistory branchId={id} />}
    </div>
  );
};

const Terminal = ({ branchId }: { branchId: number }) => {
  const { t } = useLang();
  const products = useAsync(() => productRepository.listByBranch(branchId), [branchId]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(false);

  const total = useMemo(() => cart.reduce((s, l) => s + Number(l.product.price) * l.quantity, 0), [cart]);
  const active = useMemo(() => (products.data ?? []).filter((p) => p.is_active), [products.data]);
  const grouped = useMemo(() => groupByCategory(active), [active]);

  const addToCart = (p: IProduct) => {
    setCart((c) => {
      const ex = c.find((l) => l.product.id === p.id);
      return ex ? c.map((l) => l === ex ? { ...l, quantity: l.quantity + 1 } : l) : [...c, { product: p, quantity: 1 }];
    });
  };
  const dec = (productId: number) => setCart((c) => c.flatMap((l) => l.product.id === productId
    ? (l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : [])
    : [l]));
  const removeLine = (productId: number) => setCart((c) => c.filter((l) => l.product.id !== productId));

  const checkout = async () => {
    if (!cart.length) return;
    setBusy(true); setMsg(null); setMsgOk(false);
    try {
      await orderRepository.create({
        branch_id: branchId,
        member_id: null,
        payment_method: "cash",
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      });
      const paidTotal = total;
      setCart([]);
      setMsgOk(true);
      setMsg(msgFmt(t("pos.paid"), paidTotal.toFixed(2), t("pos.cash")));
    } catch (e) {
      setMsgOk(false);
      setMsg(e instanceof Error ? e.message : t("pos.checkoutFailed"));
    } finally { setBusy(false); }
  };

  if (products.loading) return <Spinner />;
  if (products.error) return <div className="error">{products.error.message}</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, height: "100%" }}>
      <div className="col" style={{ gap: 16 }}>
        {Object.entries(grouped).map(([cat, prods]) => (
          <div key={cat}>
            <div className="muted" style={{ marginBottom: 6 }}>{cat === "Other" ? t("pos.otherCategory") : cat}</div>
            <div className="live-grid">
              {prods.map((p) => (
                <button key={p.id} className="place-cell" onClick={() => addToCart(p)} style={{ border: "1px solid #1f2a44", cursor: "pointer", textAlign: "left", background: "#0b1224" }}>
                  <span className="id" style={{ fontSize: 14 }}>{p.name}</span>
                  <span className="status" style={{ color: "#07ddf1" }}>{Number(p.price).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!active.length && <div className="muted">{t("pos.noProducts")}</div>}
      </div>

      <div className="card col" style={{ gap: 12, position: "sticky", top: 0, alignSelf: "start" }}>
        <h3 style={{ margin: 0 }}>{t("pos.cart")}</h3>
        {cart.length === 0 && <div className="muted">{t("pos.cartEmpty")}</div>}
        <div className="col" style={{ gap: 6, maxHeight: 260, overflowY: "auto" }}>
          {cart.map((l) => (
            <div key={l.product.id} className="row-between" style={{ padding: "6px 0", borderBottom: "1px solid #1f2a44" }}>
              <div style={{ flex: 1 }}>
                <div>{l.product.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>{Number(l.product.price).toFixed(2)} × {l.quantity}</div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <Button variant="secondary" onClick={() => dec(l.product.id)} style={btn}>−</Button>
                <Button variant="secondary" onClick={() => addToCart(l.product)} style={btn}>+</Button>
                <Button variant="secondary" onClick={() => removeLine(l.product.id)} style={{ ...btn, color: "#ef4444" }}>×</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="row-between" style={{ fontSize: 22, fontWeight: 800 }}>
          <span>{t("pos.total")}</span>
          <span style={{ color: "#07ddf1" }}>{total.toFixed(2)}</span>
        </div>
        <div className="row-between">
          <span className="label">{t("pos.payment")}</span>
          <span className="pill" style={{ textTransform: "none", letterSpacing: 0 }}>{t("pos.cash")}</span>
        </div>
        {msg && <div className={msgOk ? "muted" : "error"}>{msg}</div>}
        <Button onClick={checkout} disabled={busy || !cart.length}>{busy ? t("pos.processing") : msgFmt(t("pos.charge"), total.toFixed(2))}</Button>
      </div>
    </div>
  );
};

const groupByCategory = (products: IProduct[]) => {
  const out: Record<string, IProduct[]> = {};
  for (const p of products) {
    const k = p.category || "Other";
    (out[k] ||= []).push(p);
  }
  return out;
};

const btn: React.CSSProperties = { padding: "4px 8px", fontSize: 12 };

export default PosTerminal;
