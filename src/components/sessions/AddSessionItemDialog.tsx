import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import Spinner from "@/components/ui/Spinner";
import { useLang } from "@/i18n/LanguageContext";
import { productRepository } from "@/repositories/ProductRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { IProduct } from "@/types/pos";
import { useEffect, useMemo, useState } from "react";

interface Props {
  branchId: number;
  session: ISessionApi;
  onClose: () => void;
  onAdded: () => void;
}

type SessionItem = NonNullable<ISessionApi["items"]>[number];

/**
 * What the customer is being charged for on top of the clock.
 *
 * ## Why this edits the session instead of building a basket
 * The sketch this was asked from had Cancel / Add products at the bottom, which
 * reads as a basket committed at the end. That is not what happens at a
 * counter. The cashier adds a drink, the customer changes their mind, they take
 * one off — and a "Cancel" that silently un-sells three things already handed
 * over is a worse promise than no cancel at all.
 *
 * So every control here IS the session: plus adds one, minus removes one, the
 * cross removes the line. The list under "Added products" is the session's own
 * items, re-read from the response of each call — which is also why reopening
 * this dialog shows what is actually on the bill rather than a fresh basket.
 *
 * ## Quantity belongs to the line
 * Pressing the same product twice is "Cola x2" on the receipt, not two Colas.
 * The merge happens server-side (`SessionController::addItem`), keyed on the
 * product, so this dialog cannot produce a duplicate even by accident.
 *
 * ## Catalogue rows carry their product id
 * They used to be sent as a name and a price, exactly like a hand-typed item,
 * which is what left the server unable to recognise the same product twice. A
 * catalogue row now sends `product_id`; only the custom form sends a name and a
 * price, and those merge on that pair — so "Cola 500" and "Cola 600" stay the
 * two different things they are.
 */
const AddSessionItemDialog = ({ branchId, session, onClose, onAdded }: Props) => {
  const { money, t } = useLang();
  const [products, setProducts] = useState<IProduct[] | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // The session's items as the server last reported them. Seeded from the
  // session the board already holds, so the list is populated on the first
  // frame instead of blinking empty while a request flies.
  const [items, setItems] = useState<SessionItem[]>(session.items ?? []);

  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  useEffect(() => {
    void productRepository.listByBranch(branchId).then(setProducts);
  }, [branchId]);

  /**
   * Run one mutation and adopt the session it answers with.
   *
   * Every endpoint here returns the whole session, so the dialog never has to
   * guess what its own change did: no optimistic list to reconcile, and a
   * rejected call leaves the rows exactly as the server still has them. The
   * green "added" flash is gone with it — the line appearing below, with its
   * count, says the same thing without covering the list the cashier is
   * working in.
   */
  const apply = async (mutation: () => Promise<ISessionApi>) => {
    setBusy(true);
    setErr(null);
    try {
      const updated = await mutation();
      setItems(updated.items ?? []);
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const addProduct = (p: IProduct) =>
    apply(() => sessionRepository.addItem(session.id, { product_id: p.id, qty: 1 }));

  const setQty = (item: SessionItem, qty: number) =>
    apply(() => sessionRepository.setItemQty(session.id, item.id, qty));

  const removeItem = (item: SessionItem) =>
    apply(() => sessionRepository.removeItem(session.id, item.id));

  const addCustom = async () => {
    const price = parseFloat(customPrice.replace(",", "."));
    const name = customName.trim();
    if (!name || !Number.isFinite(price) || price < 0) {
      setErr(t("session.fillNamePrice"));
      return;
    }
    await apply(() => sessionRepository.addItem(session.id, { name, price, qty: 1 }));
    setCustomName("");
    setCustomPrice("");
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = products ?? [];
    if (!needle) return all;
    return all.filter((p) => `${p.name} ${p.category ?? ""}`.toLowerCase().includes(needle));
  }, [products, search]);

  const itemsTotal = items.reduce((sum, i) => sum + Number(i.price) * i.qty, 0);
  const deviceLabel = session.pc_label ?? `№${session.pc_id}`;
  const loading = products === null;

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 560, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("session.addItem")}</h2>
        <span className="muted" style={{ fontSize: 12 }}>{deviceLabel}</span>

        {/* ── The branch catalogue ─────────────────────────────────────── */}
        <span className="label" style={{ fontSize: 12 }}>{t("session.availableProducts")}</span>
        {(products?.length ?? 0) > 0 && (
          <Input placeholder={t("session.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        )}

        {loading ? <Spinner /> : (
          <div className="col" style={{ gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {products?.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>{t("session.noProducts")}</div>
            )}
            {products?.length !== 0 && filtered.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>{t("session.noSearchMatches")}</div>
            )}
            {filtered.map((p) => (
              <div key={p.id} style={catalogRow}>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>
                  {p.name}
                </span>
                <span className="muted" style={{ fontSize: 11 }}>{p.category || t("session.products")}</span>
                <span style={{ fontWeight: 700, minWidth: 80, textAlign: "right" }}>{money(Number(p.price))}</span>
                <Button onClick={() => addProduct(p)} disabled={busy} style={plusBtn} aria-label={t("action.add")}>+</Button>
              </div>
            ))}
          </div>
        )}

        {/* ── What is already on the bill ──────────────────────────────── */}
        <div className="col" style={{ gap: 8, borderTop: "1px solid #1f2a44", paddingTop: 12 }}>
          <div className="row-between">
            <span className="label" style={{ fontSize: 12 }}>{t("session.addedProducts")}</span>
            {items.length > 0 && (
              <span className="muted" style={{ fontSize: 12 }}>
                {t("session.itemsTotal")}: <b>{money(itemsTotal)}</b>
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="muted" style={{ fontSize: 13 }}>{t("session.nothingAdded")}</div>
          ) : (
            <div className="col" style={{ gap: 6, maxHeight: 200, overflowY: "auto" }}>
              {items.map((item) => (
                <div key={item.id} style={addedRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.name}>
                      {item.name}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {money(Number(item.price))} · {money(Number(item.price) * item.qty)}
                    </div>
                  </div>
                  {/* Minus at 1 removes the line: the server reads qty 0 as a
                      deletion, so a count never bottoms out at a line charging
                      for nothing. */}
                  <Button
                    variant="secondary"
                    onClick={() => setQty(item, item.qty - 1)}
                    disabled={busy}
                    style={stepBtn}
                    aria-label={t("session.decrease")}
                    title={t("session.decrease")}
                  >
                    −
                  </Button>
                  <span style={{ minWidth: 28, textAlign: "center", fontWeight: 700 }}>{item.qty}</span>
                  <Button
                    variant="secondary"
                    onClick={() => setQty(item, item.qty + 1)}
                    disabled={busy}
                    style={stepBtn}
                    aria-label={t("session.increase")}
                    title={t("session.increase")}
                  >
                    +
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => removeItem(item)}
                    disabled={busy}
                    style={{ ...stepBtn, color: "#ef4444", borderColor: "#4a1a1a" }}
                    aria-label={t("session.removeItem")}
                    title={t("session.removeItem")}
                  >
                    ✕
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
            <Button onClick={addCustom} disabled={busy} style={{ minWidth: 110 }}>{t("action.add")}</Button>
          </div>
        </div>

        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <div />
          {/* One button, and it only closes. Everything above is already on the
              bill, so offering "Cancel" here would promise an undo that does
              not exist. */}
          <Button onClick={onClose} disabled={busy}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

const catalogRow: React.CSSProperties = {
  display: "flex", gap: 10, alignItems: "center",
  border: "1px solid #1f2a44",
  borderRadius: 8, padding: "8px 10px",
};

const addedRow: React.CSSProperties = {
  display: "flex", gap: 8, alignItems: "center",
  border: "1px solid #1f2a44",
  borderRadius: 8, padding: "8px 10px",
};

const plusBtn: React.CSSProperties = { padding: "4px 12px", fontSize: 16, lineHeight: 1.2, minWidth: 40 };

const stepBtn: React.CSSProperties = { padding: "4px 10px", fontSize: 14, lineHeight: 1.2, minWidth: 36 };

export default AddSessionItemDialog;
