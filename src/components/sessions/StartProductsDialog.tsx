import type { IItemChoice, StartItem } from "@/api/sessions";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { BasketModeSwitch, BasketPicker, BasketQuickEntry } from "@/components/pos/ProductBasketPanels";
import { useProductBasket } from "@/components/pos/useProductBasket";
import { useLang } from "@/i18n/LanguageContext";
import { orderRepository } from "@/repositories/OrderRepository";
import { IProduct, isAdditionalProduct } from "@/types/pos";
import { useCallback } from "react";

/** A product chosen for the start, with what the catalogue said it costs (shown only). */
export interface StartProductLine extends StartItem {
  name: string;
  price: number;
}

interface Props {
  branchId: number;
  onClose: () => void;
  onConfirm: (lines: StartProductLine[]) => void;
}

/** Same product twice is one line with the counts added. */
export const mergeStartLines = (lines: readonly StartProductLine[]): StartProductLine[] => {
  const byId = new Map<number, StartProductLine>();
  for (const l of lines) {
    const had = byId.get(l.product_id);
    byId.set(l.product_id, had ? { ...had, qty: had.qty + l.qty } : { ...l });
  }
  return [...byId.values()];
};

/** What the chosen products come to, for the screen only (the server prices them again). */
export const startLinesTotal = (lines: readonly StartProductLine[]): number =>
  Math.round(lines.reduce((sum, l) => sum + l.price * 100 * l.qty, 0)) / 100;

/**
 * «+ Товар» in Start (2026-11-20, owner): the till's basket — catalogue,
 * search, the quick-entry box — choosing the products the player takes WITH
 * the seat. Nothing is written here: the chosen lines go back to Start, which
 * sends them with the start itself (`items`), so the seat and its products
 * land together or not at all. Only the catalogue's regular products: an
 * additional item is handed out from the seat's card.
 */
const StartProductsDialog = ({ branchId, onClose, onConfirm }: Props) => {
  const { t } = useLang();
  const allow = useCallback((p: IProduct) => p.is_active !== false && !isAdditionalProduct(p), []);
  const resolve = useCallback(
    (typed: string, choices: IItemChoice[]) => (choices.length > 0
      ? orderRepository.resolveItemsText(branchId, typed, choices)
      : orderRepository.resolveItemsText(branchId, typed)),
    [branchId],
  );
  const basket = useProductBasket({ branchId, resolve, resolveKey: branchId, allow });
  const { cart, mode, resolved, resolving } = basket;

  const lines: StartProductLine[] = mode === "picker"
    ? cart.filter((l) => l.product_id !== undefined).map((l) => ({ product_id: l.product_id as number, qty: l.qty, name: l.name, price: l.price }))
    : (resolved?.ok ? resolved.lines.filter((l) => l.product_id !== null && l.qty !== null)
      .map((l) => ({ product_id: l.product_id as number, qty: l.qty as number, name: l.name ?? "", price: l.price ?? 0 })) : []);
  const ready = lines.length > 0 && (mode === "picker" || (resolved?.ok === true && !resolving));

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 560, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }} data-testid="start-products-dialog">
        <h2 style={{ margin: 0 }}>{t("session.startProducts.title")}</h2>
        <span className="muted" style={{ fontSize: 12 }}>{t("session.startProducts.hint")}</span>
        <BasketModeSwitch basket={basket} name="cp-start-add-mode" disabled={false} />
        {mode === "picker" && <BasketPicker basket={basket} saving={false} canCreateProducts={false} />}
        {mode === "text" && <BasketQuickEntry basket={basket} saving={false} />}
        <div className="row-between">
          <Button variant="secondary" onClick={onClose}>{t("action.cancel")}</Button>
          <Button onClick={() => { onConfirm(mergeStartLines(lines)); onClose(); }} disabled={!ready} data-testid="start-products-confirm">
            {t("session.startProducts.add")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default StartProductsDialog;
