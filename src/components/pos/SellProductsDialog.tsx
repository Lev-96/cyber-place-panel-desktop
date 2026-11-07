import { can } from "@/auth/permissions";
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PaymentEditor from "@/components/payments/PaymentEditor";
import { checkPayment, emptyPaymentDraft, paymentBody, type PaymentDraft } from "@/components/payments/paymentSplit";
import { IItemChoice } from "@/api/sessions";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { orderRepository } from "@/repositories/OrderRepository";
import { notify } from "@/ui/notify";
import { IProduct, isAdditionalProduct } from "@/types/pos";
import { useCallback, useRef, useState } from "react";
import { useProductBasket } from "./useProductBasket";
import CashChangePanel from "@/components/payments/CashChangePanel";
import { billCents, cashChange } from "@/components/payments/cashChange";
import { shiftAmount, toAmount } from "@/shifts/cash";
import { BasketCreateProduct, BasketModeSwitch, BasketPicker, BasketQuickEntry } from "./ProductBasketPanels";

interface Props {
  branchId: number;
  onClose: () => void;
  onSold: () => void;
}

/** A fresh id for one press of "Sell" (see `client_request_id`). */
const newRequestId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Selling at the till, with no gaming session (2026-09-24).
 *
 * The SAME basket the session bill uses — catalogue and search, counts, and
 * the quick-entry box read by the one backend resolver ("20 lays") — and the
 * SAME payment choice a session's stop asks for. What differs is only where
 * the confirmed basket goes: a sale (`POST /orders`), never a session.
 *
 * The price is the server's: nothing sent here carries one. The whole sale
 * lands in one transaction or not at all, and one press is one sale — its
 * `client_request_id` is kept for the life of this dialog, so a double click
 * or a retry after a dropped connection returns the sale already made.
 */
const SellProductsDialog = ({ branchId, onClose, onSold }: Props) => {
  const { user } = useAuth();
  const canCreateProducts = can(user?.role, "product.crud");
  const { money, t } = useLang();
  const [saving, setSaving] = useState(false);
  // How it was paid (2026-11-07): one method or split, cash by default.
  const [pay, setPay] = useState<PaymentDraft>(() => emptyPaymentDraft("cash"));
  // Cash only: the banknotes handed over, for the change (2026-10-25) — the
  // same panel and arithmetic as the Stop receipt. Cleared on every method
  // switch, so an amount typed for cash never rides along with card.
  const [received, setReceived] = useState("");
  const requestIdRef = useRef(newRequestId());
  const inFlightRef = useRef(false);

  // The till sells what the branch still sells; the server refuses the rest.
  // Nor an additional item: it is handed out with a seat, never sold here.
  const allow = useCallback((p: IProduct) => p.is_active !== false && !isAdditionalProduct(p), []);
  const resolve = useCallback(
    (typed: string, choices: IItemChoice[]) => (choices.length > 0
      ? orderRepository.resolveItemsText(branchId, typed, choices)
      : orderRepository.resolveItemsText(branchId, typed)),
    [branchId],
  );
  const basket = useProductBasket({ branchId, resolve, resolveKey: branchId, allow });
  const { cart, mode, resolved, resolving, err, setErr } = basket;

  /** What the confirmed basket is, in the sale's own words. */
  const items = mode === "picker"
    ? cart.filter((l) => l.product_id !== undefined).map((l) => ({ product_id: l.product_id as number, quantity: l.qty }))
    : (resolved?.ok ? resolved.items.map((i) => ({ product_id: i.product_id, quantity: i.qty })) : []);
  const total = mode === "picker" ? basket.cartTotal : (resolved?.ok ? Number(resolved.total) : 0);
  const summary = mode === "picker"
    ? cart.map((l) => `${l.name} × ${l.qty}`).join(", ")
    : (resolved?.lines ?? []).filter((l) => l.product_id !== null).map((l) => `${l.name} × ${l.qty}`).join(", ");
  const ready = items.length > 0 && (mode === "picker" || (resolved?.ok === true && !resolving));
  const asksForCash = !pay.split && pay.method === "cash" && ready && total > 0;
  const payCheck = checkPayment(billCents(total), pay);
  const change = asksForCash ? cashChange(billCents(total), received) : null;
  // Too little handed over, or not a number: nothing is sold on a wrong change.
  const cashBlocks = change !== null && (change.state === "short" || change.state === "invalid");

  const sell = async () => {
    if (!ready || inFlightRef.current || cashBlocks) return;
    if (!payCheck.ok) {
      setErr(t(payCheck.problem === "note" ? (pay.split ? "pay.noteRequired" : "session.payOtherRequired")
        : payCheck.problem === "sum" ? "pay.sumMismatch" : payCheck.problem === "parts" ? "pay.needTwo" : "pay.invalid"));
      return;
    }

    inFlightRef.current = true;
    setSaving(true);
    setErr(null);
    try {
      await orderRepository.create({
        branch_id: branchId,
        // One method (its "other" text only for other), or the split parts.
        ...paymentBody(pay, payCheck),
        items,
        client_request_id: requestIdRef.current,
        ...(change?.state === "ok" ? { cash_received: toAmount(change.receivedCents) } : {}),
      });
      // The dialog closes on a sale, so the change goes with the toast too.
      notify.message("success", change?.state === "ok"
        ? `${fmt(t("till.sold"), summary)} · ${t("session.cashChange")}: ${shiftAmount(money, change.changeCents / 100)}`
        : fmt(t("till.sold"), summary));
      onSold();
      onClose();
    } catch (e) {
      // The basket stays as it is: the cashier fixes what the server objected
      // to and presses again — with the SAME request id, so a sale the server
      // did make before the answer was lost is found, not made twice.
      // Fewer banknotes than the server's total (a price changed since the
      // basket was drawn): said in the cashier's words, never as "422".
      const body = (e as { status?: number; body?: { errors?: Record<string, unknown> } });
      setErr(body.status === 422 && body.body?.errors?.cash_received !== undefined
        ? t("till.cashShortOfTotal")
        : e instanceof Error && e.message ? e.message : t("session.failUnknown"));
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={saving ? () => {} : onClose}>
      <div className="card" style={{ width: 560, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("till.sellTitle")}</h2>

        <BasketModeSwitch basket={basket} name="cp-till-add-mode" disabled={saving} />

        {mode === "picker" && (
          <BasketPicker basket={basket} saving={saving} canCreateProducts={canCreateProducts} />
        )}
        {mode === "text" && <BasketQuickEntry basket={basket} saving={saving} />}

        <PaymentEditor
          name={`till-pay-${branchId}`}
          dueCents={billCents(total)}
          value={pay}
          onChange={(next) => {
            if (next.split !== pay.split || next.method !== pay.method) setReceived("");
            setPay(next);
            setErr(null);
          }}
          check={payCheck}
          money={money}
          disabled={saving}
        />

        <div className="row-between" style={{ borderTop: "1px solid #1f2a44", paddingTop: 12 }}>
          <strong>{t("till.total")}</strong>
          <strong>{money(total)}</strong>
        </div>

        {asksForCash && change && (
          <CashChangePanel
            dueCents={billCents(total)}
            received={received}
            onReceived={(v) => { setReceived(v); setErr(null); }}
            change={change}
            disabled={saving}
            autoFocus={false}
          />
        )}

        {err !== null && <div className="error">{err || t("session.failUnknown")}</div>}
        <div className="row-between">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t("action.cancel")}</Button>
          {/* Held down until there is something to sell and, for typed
              lines, until every one of them resolved: a sale with one bad
              line is refused whole, never saved in part. */}
          <Button onClick={() => { void sell(); }} disabled={saving || !ready || cashBlocks}>
            {saving ? t("till.selling") : t("till.sellConfirm")}
          </Button>
        </div>
      </div>

      <BasketCreateProduct basket={basket} branchId={branchId} canCreateProducts={canCreateProducts} />
    </Modal>
  );
};

export default SellProductsDialog;
