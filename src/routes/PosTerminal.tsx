import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { memberRepository } from "@/repositories/MemberRepository";
import { orderRepository } from "@/repositories/OrderRepository";
import { productRepository } from "@/repositories/ProductRepository";
import { IMember } from "@/types/members";
import { CartLine, IProduct } from "@/types/pos";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const PosTerminal = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const products = useAsync(() => productRepository.listByBranch(id), [id]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<"cash" | "card" | "deposit">("cash");
  const [member, setMember] = useState<IMember | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [members, setMembers] = useState<IMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  const searchMembers = async () => {
    if (!memberSearch) return setMembers([]);
    setMembers(await memberRepository.list(id, memberSearch));
  };

  const checkout = async () => {
    if (!cart.length) return;
    if (payment === "deposit" && !member) { setMsg("Pick a member for deposit payment"); return; }
    setBusy(true); setMsg(null);
    try {
      await orderRepository.create({
        branch_id: id,
        member_id: member?.id ?? null,
        payment_method: payment,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      });
      setCart([]); setMember(null); setMembers([]); setMemberSearch("");
      setMsg(`Paid ${total.toFixed(2)} (${payment})`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Checkout failed");
    } finally { setBusy(false); }
  };

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;
  if (products.loading) return <Spinner />;
  if (products.error) return <div className="error">{products.error.message}</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, height: "100%" }}>
      <div className="col" style={{ gap: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>POS · branch #{id}</h2>
        {Object.entries(grouped).map(([cat, prods]) => (
          <div key={cat}>
            <div className="muted" style={{ marginBottom: 6 }}>{cat}</div>
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
        {!active.length && <div className="muted">No active products. Add some in Products page.</div>}
      </div>

      <div className="card col" style={{ gap: 12, position: "sticky", top: 0, alignSelf: "start" }}>
        <h3 style={{ margin: 0 }}>Cart</h3>
        {cart.length === 0 && <div className="muted">Empty</div>}
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
          <span>Total</span>
          <span style={{ color: "#07ddf1" }}>{total.toFixed(2)}</span>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="label">Payment</span>
          <div className="row" style={{ gap: 6 }}>
            {(["cash", "card", "deposit"] as const).map((m) => (
              <Button key={m} variant={payment === m ? "primary" : "secondary"} onClick={() => setPayment(m)} style={{ flex: 1, padding: "8px 0" }}>{m}</Button>
            ))}
          </div>
        </div>
        {payment === "deposit" && (
          <div className="col" style={{ gap: 6 }}>
            <span className="label">Member</span>
            {member ? (
              <div className="row-between">
                <div>{member.name} <span className="muted">· balance {Number(member.balance).toFixed(2)}</span></div>
                <Button variant="secondary" onClick={() => setMember(null)} style={btn}>Change</Button>
              </div>
            ) : (
              <>
                <input className="input" placeholder="Name / phone / card" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchMembers()} />
                {members.map((m) => (
                  <button key={m.id} className="list-item" onClick={() => { setMember(m); setMembers([]); }}>
                    <div>{m.name} <span className="muted">{m.phone}</span></div>
                    <div className="muted">{Number(m.balance).toFixed(2)}</div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
        {msg && <div className={msg.startsWith("Paid") ? "muted" : "error"}>{msg}</div>}
        <Button onClick={checkout} disabled={busy || !cart.length}>{busy ? "Processing…" : `Charge ${total.toFixed(2)}`}</Button>
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
