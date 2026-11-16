import { stockWarningText, stockWarningsOf } from "@/components/products/stock";
import { tActive } from "@/i18n/translations";
import { notify } from "@/ui/notify";

/**
 * After a sale (2026-11-16): an AMBER toast when it took a counted product
 * below zero — «Остаток ниже нуля: Кола −2. Продажа прошла, проверьте
 * остаток.» The sale went through; nothing is refused or undone. Raised where
 * the answer is read (the till's and the bill's repositories), so every
 * dialog that sells says it the same way. An answer without the key (nothing
 * went below zero, or an older backend) says nothing.
 */
export const announceStockWarnings = (body: unknown): void => {
  const text = stockWarningText(stockWarningsOf(body), tActive("stock.warnBelowZero"));
  if (text !== null) notify.warning(text);
};
