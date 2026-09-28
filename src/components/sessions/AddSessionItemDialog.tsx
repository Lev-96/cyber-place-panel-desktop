import { can } from "@/auth/permissions";
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { sessionRepository } from "@/repositories/SessionRepository";
import { sessionItemLineTotal } from "@/components/sessions/sessionAmount";
import { notify } from "@/ui/notify";
import { ISessionApi } from "@/types/sessions";
import { IProduct, isAdditionalProduct, isChipsProduct } from "@/types/pos";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useProductBasket } from "@/components/pos/useProductBasket";
import SectionTabs from "@/components/ui/SectionTabs";
import {
  BasketAdditionalItems,
  BasketCreateProduct,
  BasketModeSwitch,
  BasketPicker,
  BasketQuickEntry,
  ellipsis,
  rowStyle,
  stepBtn,
} from "@/components/pos/ProductBasketPanels";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IItemChoice } from "@/api/sessions";

interface Props {
  branchId: number;
  session: ISessionApi;
  onClose: () => void;
  onAdded: () => void;
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
  const [saving, setSaving] = useState(false);
  const confirmingRef = useRef(false);
  /** Which part of the dialog is open: the products, or the additional items. */
  const [section, setSection] = useState<"products" | "additional">("products");

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
  // A withdrawn product is not for sale here either (2026-09-25): the server
  // refuses it on the bill, as the till always did.
  // An additional item (chips, a cue — handed out once, on any seat) is not
  // in this list: it has its own section below, with its own rule.
  const allow = useCallback(
    (p: IProduct) => p.is_active !== false && !isAdditionalProduct(p) && (sellsChips || !isChipsProduct(p)),
    [sellsChips],
  );
  // The picks travel only when there are some, so an ordinary read is the
  // request it always was.
  const resolve = useCallback(
    (typed: string, choices: IItemChoice[]) => (choices.length > 0
      ? sessionRepository.resolveItemsText(session.id, typed, choices)
      : sessionRepository.resolveItemsText(session.id, typed)),
    [session.id],
  );

  // The catalogue, the basket and the quick entry — shared with the till's
  // sale dialog (components/pos). What the basket is FOR stays here: this
  // seat's bill.
  const basket = useProductBasket({ branchId, resolve, resolveKey: session.id, allow });
  const { cart, setCart, mode, resolved, setResolved, setText, resolving, err, setErr } = basket;

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
  const ask = useConfirm();
  // The catalogue's additional items, by id — to label them on the bill.
  const additionalIds = new Set((basket.products ?? []).filter(isAdditionalProduct).map((p) => p.id));
  /** The branch hands something out with the seat — only then are there two sections. */
  const hasAdditional = (basket.products ?? []).some((p) => isAdditionalProduct(p) && p.is_active !== false);
  const shown = hasAdditional ? section : "products";
  const itemPayload = basket.itemLines.map((l) => ({ product_id: l.product_id as number, qty: 1 }));
  // Typed mode: the typed lines must all resolve (a batch is never saved in
  // part), or the box is empty and only additional items are being added.
  const textEmpty = basket.text.trim() === "";
  const textReady = !resolving && (textEmpty ? itemPayload.length > 0 : resolved?.ok === true && resolved.items.length > 0);
  const onBillIds = new Set(bill.map((i) => i.product_id).filter((id): id is number => id !== null && id !== undefined));

  // A fresh session from the parent (after a confirm, or a realtime update)
  // replaces what we hold, so the two never drift.
  useEffect(() => { setBill(session.items ?? []); }, [session]);

  /**
   * Take a line off the bill.
   *
   * Unlike everything else here this goes to the server at once — the line is
   * already on a bill somebody may be about to pay, so "removed" has to mean
   * removed. The row is disabled while it is in flight, and a refusal says why
   * instead of claiming success.
   */
  /**
   * What landed, said in two parts: the products as always («… × 2»), and the
   * additional items as what happened to them — handed out — in a toast of
   * their own, so a cue never reads as "Cue × 1 sold".
   */
  const announceAdded = (products: Array<{ name: string; qty: number }>, items: string[]) => {
    if (products.length === 1) {
      notify.message("success", fmt(t("session.addedOne"), products[0].name, products[0].qty));
    } else if (products.length > 1) {
      notify.message("success", fmt(t("session.addedMany"), products.map((l) => `${l.name} × ${l.qty}`).join(", ")));
    }
    if (items.length > 0) notify.message("success", fmt(t("session.additionalGiven"), items.join(", ")));
  };

  const removeFromBill = async (itemId: number, name: string, additional: boolean) => {
    if (removing.includes(itemId)) return;
    // Taking something off a bill is asked first: one misplaced click must
    // not un-sell a drink or take a cue back. An additional item is asked
    // about — and reported — as what it is.
    const question = additional ? "session.additionalRemoveConfirm" : "session.removeConfirm";
    if (!(await ask(fmt(t(question), name), { destructive: true }))) return;
    setRemoving((prev) => [...prev, itemId]);
    try {
      const updated = await sessionRepository.removeItem(session.id, itemId);
      setBill(updated?.items ?? bill.filter((i) => i.id !== itemId));
      notify.message("error", fmt(t(additional ? "session.additionalRemoved" : "session.removedOne"), name));
      onAdded();
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : t("session.failUnknown");
      notify.message("error", `${t("session.removeFailed")} ${fmt(t("session.failReason"), reason)}`);
    } finally {
      setRemoving((prev) => prev.filter((id) => id !== itemId));
    }
  };

  /**
   * The typed batch, confirmed — through the SAME endpoint the basket uses.
   *
   * The resolver handed back the exact `items` that endpoint expects, so this
   * is the picker's write path with a different way of filling it: one
   * request, one transaction, one audit line, and the same refusal if the
   * session stopped meanwhile.
   */
  const confirmText = async () => {
    // The ref answers a double press inside one frame; `saving` only greys
    // the button once React has rendered.
    if (!textReady || saving || confirmingRef.current) return;
    confirmingRef.current = true;
    setSaving(true);
    setErr(null);
    try {
      // The typed lines AND the additional items chosen on their tab, in the
      // one request: an item picked there must not be dropped because the
      // products were typed rather than picked.
      const typed = resolved?.ok ? resolved.items : [];
      await sessionRepository.addItems(session.id, [...typed, ...itemPayload]);

      announceAdded(
        (resolved?.ok ? resolved.lines : [])
          .filter((l) => l.product_id !== null)
          .map((l) => ({ name: l.name ?? "", qty: l.qty ?? 0 })),
        basket.itemLines.map((l) => l.name),
      );

      setText("");
      setResolved(null);
      onAdded();
      onClose();
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : t("session.failUnknown");
      setErr(`${t("session.addFailedMany")} ${fmt(t("session.failReason"), reason)}`);
    } finally {
      confirmingRef.current = false;
      setSaving(false);
    }
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

      announceAdded(basket.productLines, basket.itemLines.map((l) => l.name));

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

  const onBill = bill;
  const deviceLabel = session.pc_label ?? `№${session.pc_id}`;

  return (
    <Modal open onClose={saving ? () => {} : onClose}>
      <div className="card" style={{ width: 560, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("session.addItem")}</h2>
        <span className="muted" style={{ fontSize: 12 }}>{deviceLabel}</span>

        {/* Two sections when the branch hands things out with the seat:
            what is SOLD (products) and what is HANDED OUT (additional items).
            One basket and one confirm behind both. */}
        {hasAdditional && (
          <SectionTabs
            label={t("session.addSections")}
            value={shown}
            onChange={setSection}
            disabled={saving}
            tabs={[
              { key: "products", label: t("session.sectionProducts"), count: mode === "picker" ? basket.productLines.length : (resolved?.ok ? resolved.items.length : 0) },
              { key: "additional", label: t("session.additionalTitle"), count: basket.itemLines.length },
            ]}
          />
        )}

        {/* Two ways in — the picker, as this dialog always opened, and the
            quick-entry box. */}
        {shown === "products" && <BasketModeSwitch basket={basket} name="cp-session-add-mode" disabled={saving} />}

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
                  <span style={ellipsis} title={item.name}>
                    {item.name}
                    {item.product_id != null && additionalIds.has(item.product_id) && (
                      <span className="pill" style={{ marginLeft: 6, fontSize: 10, textTransform: "none", letterSpacing: 0 }}>
                        {t("product.kindAdditionalShort")}
                      </span>
                    )}
                  </span>
                  {/* An additional item has no count: it was handed out or not. */}
                  <span style={{ minWidth: 40, textAlign: "center", fontWeight: 700 }}>
                    {item.product_id != null && additionalIds.has(item.product_id) ? "" : `× ${item.qty}`}
                  </span>
                  <span className="muted" style={{ fontSize: 11, minWidth: 74, textAlign: "right" }}>
                    {money(sessionItemLineTotal(item))}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => void removeFromBill(item.id, item.name, item.product_id != null && additionalIds.has(item.product_id))}
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

        {shown === "products" && mode === "picker" && (
          <BasketPicker basket={basket} saving={saving} canCreateProducts={canCreateProducts} />
        )}

        {/* ── Quick entry ──────────────────────────────────────────────────
            Nothing is on the bill until the cashier presses the confirm below. */}
        {shown === "products" && mode === "text" && <BasketQuickEntry basket={basket} saving={saving} />}

        {shown === "additional" && <BasketAdditionalItems basket={basket} saving={saving} onBill={onBillIds} />}

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
            <Button onClick={confirmText} disabled={saving || !textReady}>
              {saving ? t("session.adding") : t("session.quickEntryConfirm")}
            </Button>
          )}
        </div>
      </div>

      {/* The Products screen's own form, unchanged: whatever it creates is a
          product like any other, with its three languages and its category. */}
      <BasketCreateProduct basket={basket} branchId={branchId} canCreateProducts={canCreateProducts} />
    </Modal>
  );
};

export default AddSessionItemDialog;
