import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import Spinner from "@/components/ui/Spinner";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { productRepository } from "@/repositories/ProductRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { notify } from "@/ui/notify";
import { ISessionApi } from "@/types/sessions";
import { IProduct } from "@/types/pos";
import { useEffect, useMemo, useState } from "react";

interface Props {
  branchId: number;
  session: ISessionApi;
  onClose: () => void;
  onAdded: () => void;
}

/** A line the cashier has selected but not yet confirmed. */
interface CartLine {
  /** Stable within the dialog: the product id, or the typed name + price. */
  key: string;
  product_id?: number;
  name: string;
  price: number;
  qty: number;
}

/**
 * The basket a cashier fills before committing it to the session.
 *
 * ## Nothing reaches the server until it is confirmed
 * Choosing a product, changing a count, taking a line back out — all of it is
 * local. That is the point: the cashier is deciding, and a decision in progress
 * should not be visible on a bill, nor leave a trail of rows to undo when they
 * change their mind. One request goes out when they press the confirm button,
 * carrying the whole basket, and the backend applies it in a transaction — so
 * either every line lands or none does and the basket is still here to fix.
 *
 * ## What "Cancel" means here, and why it can exist
 * It discards the basket, and that is an honest promise precisely because
 * nothing has been written yet. (An earlier version of this dialog wrote each
 * change immediately; a Cancel there would have claimed to un-sell things
 * already handed across the counter, so it did not offer one.)
 *
 * ## Quantity is part of the line
 * Pressing the same product twice raises its count instead of opening a second
 * line — locally here, and again server-side when the basket lands, so a basket
 * containing something the session already has raises that line rather than
 * duplicating it.
 */
const AddSessionItemDialog = ({ branchId, session, onClose, onAdded }: Props) => {
  const { money, t } = useLang();
  const [products, setProducts] = useState<IProduct[] | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  useEffect(() => {
    void productRepository.listByBranch(branchId).then(setProducts);
  }, [branchId]);

  /** Add one, or raise the count of the line that is already in the basket. */
  const put = (line: Omit<CartLine, "qty">) =>
    setCart((prev) => {
      const at = prev.findIndex((l) => l.key === line.key);
      if (at < 0) return [...prev, { ...line, qty: 1 }];
      const next = [...prev];
      next[at] = { ...next[at], qty: next[at].qty + 1 };
      return next;
    });

  /** Move a count, dropping the line when it reaches zero. */
  const step = (key: string, by: number) =>
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.key !== key) return [l];
        const qty = l.qty + by;
        return qty > 0 ? [{ ...l, qty }] : [];
      }),
    );

  const drop = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const addCustom = () => {
    const price = parseFloat(customPrice.replace(",", "."));
    const name = customName.trim();
    if (!name || !Number.isFinite(price) || price < 0) {
      setErr(t("session.fillNamePrice"));
      return;
    }
    setErr(null);
    put({ key: `custom:${name}:${price}`, name, price });
    setCustomName("");
    setCustomPrice("");
  };

  /**
   * The one request. On failure the basket is deliberately left untouched —
   * the cashier has to be able to fix whatever the server objected to and try
   * again, not rebuild a selection the app threw away on their behalf.
   */
  const confirm = async () => {
    if (!cart.length || saving) return;
    setSaving(true);
    setErr(null);
    try {
      await sessionRepository.addItems(
        session.id,
        cart.map((l) => (l.product_id
          ? { product_id: l.product_id, qty: l.qty }
          : { name: l.name, price: l.price, qty: l.qty })),
      );

      const summary = cart.map((l) => `${l.name} × ${l.qty}`).join(", ");
      notify.message(
        "success",
        cart.length === 1
          ? fmt(t("session.addedOne"), cart[0].name, cart[0].qty)
          : fmt(t("session.addedMany"), summary),
      );

      setCart([]);
      onAdded();
      onClose();
    } catch (e) {
      // The backend's own sentence, when it sent one — "this session is no
      // longer active" tells the cashier what to do; "Server Error" does not.
      const reason = e instanceof Error && e.message ? e.message : t("session.failUnknown");
      notify.message(
        "error",
        `${cart.length === 1 ? t("session.addFailedOne") : t("session.addFailedMany")} ${fmt(t("session.failReason"), reason)}`,
      );
      setErr(reason);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = products ?? [];
    if (!needle) return all;
    return all.filter((p) => `${p.name} ${p.category ?? ""}`.toLowerCase().includes(needle));
  }, [products, search]);

  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
  const onBill = session.items ?? [];
  const deviceLabel = session.pc_label ?? `№${session.pc_id}`;
  const loading = products === null;

  return (
    <Modal open onClose={saving ? () => {} : onClose}>
      <div className="card" style={{ width: 560, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("session.addItem")}</h2>
        <span className="muted" style={{ fontSize: 12 }}>{deviceLabel}</span>

        {/* What the session already holds — read-only, so the cashier can see
            they are about to add a second coffee before they do it. */}
        {onBill.length > 0 && (
          <span className="muted" style={{ fontSize: 12 }}>
            {t("session.alreadyInSession")}: {onBill.map((i) => `${i.name} × ${i.qty}`).join(", ")}
          </span>
        )}

        {/* ── The branch catalogue ─────────────────────────────────────── */}
        <span className="label" style={{ fontSize: 12 }}>{t("session.availableProducts")}</span>
        {(products?.length ?? 0) > 0 && (
          <Input placeholder={t("session.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        )}

        {loading ? <Spinner /> : (
          <div className="col" style={{ gap: 6, maxHeight: 190, overflowY: "auto" }}>
            {products?.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>{t("session.noProducts")}</div>
            )}
            {products?.length !== 0 && filtered.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>{t("session.noSearchMatches")}</div>
            )}
            {filtered.map((p) => (
              <div key={p.id} style={rowStyle}>
                <span style={ellipsis} title={p.name}>{p.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>{p.category || t("session.products")}</span>
                <span style={{ fontWeight: 700, minWidth: 80, textAlign: "right" }}>{money(Number(p.price))}</span>
                <Button
                  onClick={() => put({ key: `p:${p.id}`, product_id: p.id, name: p.name, price: Number(p.price) })}
                  disabled={saving}
                  style={plusBtn}
                  // Named per product: a column of identical "Add" buttons is
                  // unreadable to a screen reader, and to a test.
                  aria-label={`${t("action.add")}: ${p.name}`}
                >
                  +
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* ── The basket ───────────────────────────────────────────────── */}
        <div className="col" style={{ gap: 8, borderTop: "1px solid #1f2a44", paddingTop: 12 }}>
          <div className="row-between">
            <span className="label" style={{ fontSize: 12 }}>{t("session.addedProducts")}</span>
            {cart.length > 0 && (
              <span className="muted" style={{ fontSize: 12 }}>
                {t("session.itemsTotal")}: <b>{money(cartTotal)}</b>
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>{t("session.cartEmpty")}</div>
          ) : (
            <div className="col" style={{ gap: 6, maxHeight: 190, overflowY: "auto" }}>
              {cart.map((line) => (
                <div key={line.key} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={ellipsis} title={line.name}>{line.name}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {money(line.price)} · {money(line.price * line.qty)}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => step(line.key, -1)}
                    disabled={saving}
                    style={stepBtn}
                    aria-label={t("session.decrease")}
                    title={t("session.decrease")}
                  >
                    −
                  </Button>
                  <span style={{ minWidth: 28, textAlign: "center", fontWeight: 700 }}>{line.qty}</span>
                  <Button
                    variant="secondary"
                    onClick={() => step(line.key, 1)}
                    disabled={saving}
                    style={stepBtn}
                    aria-label={t("session.increase")}
                    title={t("session.increase")}
                  >
                    +
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => drop(line.key)}
                    disabled={saving}
                    style={{ ...stepBtn, color: "#ef4444", borderColor: "#4a1a1a" }}
                    title={t("action.delete")}
                  >
                    {t("action.delete")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Something the branch does not stock ──────────────────────── */}
        <div className="col" style={{ gap: 8, borderTop: "1px solid #1f2a44", paddingTop: 12 }}>
          <span className="label" style={{ fontSize: 12 }}>{t("session.customItem")}</span>
          <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
            <Input
              label=""
              placeholder={t("session.itemName")}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              style={{ flex: 2 }}
            />
            <div style={{ flex: 1 }}>
              <PriceInput
                placeholder={t("session.itemPrice")}
                value={customPrice}
                onChange={setCustomPrice}
              />
            </div>
            <Button onClick={addCustom} disabled={saving} style={{ minWidth: 110 }}>{t("action.add")}</Button>
          </div>
        </div>

        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
          {/* Disabled while the request is in flight, so a second press cannot
              send the same basket twice. */}
          <Button onClick={confirm} disabled={saving || cart.length === 0}>
            {saving
              ? t("session.adding")
              : cart.length === 1
                ? t("session.cartConfirmOne")
                : t("session.cartConfirmMany")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const rowStyle: React.CSSProperties = {
  display: "flex", gap: 8, alignItems: "center",
  border: "1px solid #1f2a44",
  borderRadius: 8, padding: "8px 10px",
};

const ellipsis: React.CSSProperties = {
  flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const plusBtn: React.CSSProperties = { padding: "4px 12px", fontSize: 16, lineHeight: 1.2, minWidth: 40 };

const stepBtn: React.CSSProperties = { padding: "4px 10px", fontSize: 13, lineHeight: 1.2, minWidth: 36 };

export default AddSessionItemDialog;
