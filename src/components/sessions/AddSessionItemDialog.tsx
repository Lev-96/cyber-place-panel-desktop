import { can } from "@/auth/permissions";
import { useAuth } from "@/auth/AuthContext";
import { ListSkeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import ProductForm from "@/components/products/ProductForm";
import Modal from "@/components/ui/Modal";
import Radio from "@/components/ui/Radio";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { productRepository } from "@/repositories/ProductRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { notify } from "@/ui/notify";
import { ISessionApi } from "@/types/sessions";
import { IResolvedItems } from "@/api/sessions";
import { IProduct, isChipsProduct } from "@/types/pos";
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
 *
 * ## A branch with no catalogue can start one from here
 * The first session of a new venue runs into an empty product list, and sending
 * the cashier off to another screen to fix that loses the basket and the
 * thread. "New product" opens the SAME form the Products screen uses and
 * creates a real `Product` — it appears under Products like any other, because
 * it is one. It is not a line invented for this bill: a per-session pseudo
 * product would be invisible to stock, to the catalogue and to the next
 * session. The new product then drops straight into the basket, since creating
 * it here means wanting it here.
 *
 * ## What is already on the bill can be taken off it
 * The lines the session already holds are listed with a remove of their own.
 * That one IS immediate — it is a correction to a bill that exists, not a
 * decision in progress — and it says so with its own toast.
 */
const AddSessionItemDialog = ({ branchId, session, onClose, onAdded }: Props) => {
  const { user } = useAuth();
  /** Mirrors the backend's `products.manage`; the two are pinned by tests on both sides. */
  const canCreateProducts = can(user?.role, "product.crud");
  const { money, t } = useLang();
  const [products, setProducts] = useState<IProduct[] | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  /**
   * Which way the cashier is adding things.
   *
   * `picker` is the way this dialog has always worked and the way it opens:
   * nothing about it changes, and a cashier who never touches the switch never
   * sees the difference. `text` is the shortcut for an order of five things,
   * where finding each one in a list is the slow part.
   */
  const [mode, setMode] = useState<"picker" | "text">("picker");
  const [text, setText] = useState("");
  const [resolved, setResolved] = useState<IResolvedItems | null>(null);
  const [resolving, setResolving] = useState(false);

  const [creating, setCreating] = useState(false);
  /**
   * The bill, as this dialog knows it.
   *
   * Seeded from the session it was opened with and updated from the server's
   * own answer when a line is removed. The parent is told as well, but its
   * refresh does not reach a dialog that is already open — so without a copy
   * here a removed line stayed on screen until the dialog was closed and
   * reopened, which reads as "it did not work".
   */
  const [bill, setBill] = useState(session.items ?? []);
  /** Items being taken off the bill, so their row can say so. */
  const [removing, setRemoving] = useState<number[]>([]);

  useEffect(() => {
    void productRepository.listByBranch(branchId).then(setProducts);
  }, [branchId]);

  // A fresh session from the parent (after a confirm, or a realtime update)
  // replaces what we hold, so the two never drift.
  useEffect(() => { setBill(session.items ?? []); }, [session]);

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

  /**
   * A product that now exists everywhere, and is in the basket besides.
   *
   * Two steps that cannot be one: the product is a row of its own, the basket
   * is a decision not yet committed. Doing it this way means neither can leave
   * the other half-done — the catalogue keeps the product whatever happens to
   * the basket next, and nothing reaches the bill until the cashier confirms
   * it, so there is no window in which a product exists "only for this
   * session" or a bill line points at a product that was never created.
   */
  const onProductCreated = (p: IProduct) => {
    setCreating(false);
    setProducts((prev) => (prev ? [p, ...prev.filter((x) => x.id !== p.id)] : [p]));
    put({ key: `p:${p.id}`, product_id: p.id, name: p.name, price: Number(p.price) });
    setErr(null);
  };

  /**
   * Take a line off the bill.
   *
   * Unlike everything else here this goes to the server at once — the line is
   * already on a bill somebody may be about to pay, so "removed" has to mean
   * removed. The row is disabled while it is in flight, and a refusal says why
   * instead of claiming success.
   */
  const removeFromBill = async (itemId: number, name: string) => {
    if (removing.includes(itemId)) return;
    setRemoving((prev) => [...prev, itemId]);
    try {
      const updated = await sessionRepository.removeItem(session.id, itemId);
      setBill(updated?.items ?? bill.filter((i) => i.id !== itemId));
      notify.message("error", fmt(t("session.removedOne"), name));
      onAdded();
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : t("session.failUnknown");
      notify.message("error", `${t("session.removeFailed")} ${fmt(t("session.failReason"), reason)}`);
    } finally {
      setRemoving((prev) => prev.filter((id) => id !== itemId));
    }
  };

  /**
   * The one request. On failure the basket is deliberately left untouched —
   * the cashier has to be able to fix whatever the server objected to and try
   * again, not rebuild a selection the app threw away on their behalf.
   */
  /**
   * Reads the box as the cashier types, 400ms after they stop.
   *
   * One request per pause rather than one per line, and it writes nothing —
   * the server is only being asked which products these words are. An empty
   * box asks nothing at all: the field is `required` there, and a refusal for
   * a box nobody has typed in yet is noise.
   */
  useEffect(() => {
    if (mode !== "text") return;

    const typed = text.trim();
    if (typed === "") {
      setResolved(null);
      setResolving(false);
      return;
    }

    setResolving(true);
    let dropped = false;
    const timer = setTimeout(() => {
      sessionRepository.resolveItemsText(session.id, typed)
        .then((r) => { if (!dropped) { setResolved(r); setErr(null); } })
        .catch((e) => {
          if (dropped) return;
          setResolved(null);
          // The server's own sentence is kept as it came. Translating in here
          // would put `t` in the dependency list below, and a `t` that is a new
          // function on every render restarts the debounce forever — the box
          // would read as busy and the confirm would never unlock.
          setErr(e instanceof Error && e.message ? e.message : null);
        })
        .finally(() => { if (!dropped) setResolving(false); });
    }, 400);

    return () => { dropped = true; clearTimeout(timer); };
  }, [mode, text, session.id]);

  /**
   * The typed batch, confirmed — through the SAME endpoint the basket uses.
   *
   * The resolver handed back the exact `items` that endpoint expects, so this
   * is the picker's write path with a different way of filling it: one
   * request, one transaction, one audit line, and the same refusal if the
   * session stopped meanwhile.
   */
  const confirmText = async () => {
    if (!resolved?.ok || !resolved.items.length || saving) return;
    setSaving(true);
    setErr(null);
    try {
      await sessionRepository.addItems(session.id, resolved.items);

      const summary = resolved.lines
        .filter((l) => l.product_id !== null)
        .map((l) => `${l.name} × ${l.qty}`)
        .join(", ");
      notify.message("success", fmt(t("session.addedMany"), summary));

      setText("");
      setResolved(null);
      onAdded();
      onClose();
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : t("session.failUnknown");
      setErr(`${t("session.addFailedMany")} ${fmt(t("session.failReason"), reason)}`);
    } finally {
      setSaving(false);
    }
  };

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

  /**
   * Chips are a poker table's product, and only a poker table's.
   *
   * The catalogue is one list per branch, so a venue that sells chips sells
   * them to every screen that reads it. This is where a PlayStation stops
   * seeing them — and the server refuses the sale on the same answer, so the
   * two cannot disagree about what a seat may be charged for.
   *
   * `supports_chips` is the server's own, from the seat's place. Absent on an
   * older payload, which reads as "not a poker table": the safe direction.
   */
  const sellsChips = session.supports_chips === true;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sellable = (products ?? []).filter((p) => sellsChips || !isChipsProduct(p));
    if (!needle) return sellable;
    return sellable.filter((p) => `${p.name} ${p.category ?? ""}`.toLowerCase().includes(needle));
  }, [products, search, sellsChips]);

  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
  const onBill = bill;
  const deviceLabel = session.pc_label ?? `№${session.pc_id}`;
  const loading = products === null;

  return (
    <Modal open onClose={saving ? () => {} : onClose}>
      <div className="card" style={{ width: 560, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("session.addItem")}</h2>
        <span className="muted" style={{ fontSize: 12 }}>{deviceLabel}</span>

        {/* Two ways in, and the one that has always been here is the one the
            dialog opens on. The switch is a radiogroup rather than a tab strip
            because it is a choice about how to work, not a place to navigate
            to — and because the picker's own state survives the trip: a basket
            half-filled is still there when the cashier comes back. */}
        <div className="row" role="radiogroup" aria-label={t("session.addMode")} style={{ gap: 16, flexWrap: "wrap" }}>
          <Radio
            name="cp-session-add-mode"
            checked={mode === "picker"}
            onChange={() => setMode("picker")}
            disabled={saving}
            label={t("session.addModePicker")}
          />
          <Radio
            name="cp-session-add-mode"
            checked={mode === "text"}
            onChange={() => setMode("text")}
            disabled={saving}
            label={t("session.addModeText")}
          />
        </div>

        {/* What the session already holds. Listed rather than summarised in a
            sentence, because each line needs its own way off the bill — and
            because a cashier about to add a second coffee should see the first
            one before they do. */}
        {onBill.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            <span className="label" style={{ fontSize: 12 }}>{t("session.alreadyInSession")}</span>
            <div className="col" style={{ gap: 6, maxHeight: 150, overflowY: "auto" }}>
              {onBill.map((item) => (
                <div key={item.id} style={rowStyle}>
                  <span style={ellipsis} title={item.name}>{item.name}</span>
                  <span style={{ minWidth: 40, textAlign: "center", fontWeight: 700 }}>× {item.qty}</span>
                  <span className="muted" style={{ fontSize: 11, minWidth: 74, textAlign: "right" }}>
                    {money(Number(item.price) * item.qty)}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => void removeFromBill(item.id, item.name)}
                    disabled={saving || removing.includes(item.id)}
                    style={{ ...stepBtn, color: "#ef4444", borderColor: "#4a1a1a" }}
                    aria-label={`${t("action.delete")}: ${item.name}`}
                    title={t("session.removeFromBill")}
                  >
                    {removing.includes(item.id) ? "…" : "🗑"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === "picker" && (
          <>
        {/* ── The branch catalogue ─────────────────────────────────────── */}
        <span className="label" style={{ fontSize: 12 }}>{t("session.availableProducts")}</span>
        {(products?.length ?? 0) > 0 && (
          <Input placeholder={t("session.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        )}

        {loading ? <ListSkeleton rows={3} /> : (
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

        {/* ── Something the branch does not stock yet ──────────────────────
            Owner-level, and only shown to one. A manager sells from the
            catalogue; writing it is the company's, which is what the backend
            has always answered (`products.manage` → 403). Until this gate the
            button was drawn for everyone, so the one role that could not use it
            was the role standing at the counter — they pressed it and got a
            permission error mid-sale. */}
        {canCreateProducts && (
          <div className="col" style={{ gap: 8, borderTop: "1px solid #1f2a44", paddingTop: 12 }}>
            <div className="row-between" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>{t("session.createProductHint")}</span>
              <Button variant="secondary" onClick={() => setCreating(true)} disabled={saving}>
                {t("session.createProduct")}
              </Button>
            </div>
          </div>
        )}
          </>
        )}

        {/* ── Quick entry ──────────────────────────────────────────────────
            One line per product, the number at either end. Nothing is on the
            bill until the cashier presses the confirm below: what this shows
            is the server's reading of the text, priced from the catalogue. */}
        {mode === "text" && (
          <div className="col" style={{ gap: 8 }}>
            <span className="label" style={{ fontSize: 12 }}>{t("session.quickEntry")}</span>
            <textarea
              className="input"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={saving}
              placeholder={t("session.quickEntryPlaceholder")}
              aria-label={t("session.quickEntry")}
              style={{ resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            />
            <span className="muted" style={{ fontSize: 11 }}>{t("session.quickEntryHint")}</span>

            {resolving && (
              <span className="muted" style={{ fontSize: 11 }}>{t("session.quickEntryReading")}</span>
            )}

            {resolved !== null && resolved.lines.length > 0 && (
              <div className="col" style={{ gap: 6 }}>
                <span className="label" style={{ fontSize: 12 }}>{t("session.quickEntryPreview")}</span>
                <div className="col" style={{ gap: 6, maxHeight: 220, overflowY: "auto" }}>
                  {resolved.lines.map((line, i) => (
                    <div key={`${line.raw}-${i}`} className="col" style={{ gap: 2 }}>
                      {line.error === null ? (
                        <div className="row-between" style={{ gap: 8 }}>
                          <span>{line.name} × {line.qty}</span>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {money(line.price ?? 0)} · {money(line.line_total ?? 0)}
                          </span>
                        </div>
                      ) : (
                        <div className="col" style={{ gap: 2 }}>
                          <span className="error" style={{ fontSize: 12 }}>
                            {fmt(t("session.quickEntryLine"), line.raw)} {line.error}
                          </span>
                          {line.candidates.length > 0 && (
                            <span className="muted" style={{ fontSize: 11 }}>
                              {fmt(t("session.quickEntryCandidates"), line.candidates.join(", "))}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {resolved.ok && (
                  <div className="row-between" style={{ gap: 8 }}>
                    <span className="label" style={{ fontSize: 12 }}>{t("session.quickEntryTotal")}</span>
                    <span>{money(resolved.total)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {err !== null && <div className="error">{err || t("session.failUnknown")}</div>}
        <div className="row-between">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
          {/* Disabled while the request is in flight, so a second press cannot
              send the same basket twice. */}
          {mode === "picker" ? (
            <Button onClick={confirm} disabled={saving || cart.length === 0}>
              {saving
                ? t("session.adding")
                : cart.length === 1
                  ? t("session.cartConfirmOne")
                  : t("session.cartConfirmMany")}
            </Button>
          ) : (
            /* Held down until every typed line resolved. A batch with one bad
               line is not saved in part — the server would refuse it anyway,
               and a bill missing its middle line is one nobody chose. */
            <Button onClick={confirmText} disabled={saving || resolving || !resolved?.ok}>
              {saving ? t("session.adding") : t("session.quickEntryConfirm")}
            </Button>
          )}
        </div>
      </div>

      {/* The Products screen's own form, unchanged: whatever it creates is a
          product like any other, with its three languages and its category. */}
      {creating && canCreateProducts && (
        <ProductForm
          branchId={branchId}
          onClose={() => setCreating(false)}
          onSaved={onProductCreated}
        />
      )}
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
