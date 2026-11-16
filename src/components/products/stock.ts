import { fmt } from "@/i18n/translations";
import { IStockChange, IStockWarning } from "@/types/pos";

/**
 * Stock on screen (2026-11-16) — pure, so every surface says it the same
 * way. Every figure is the server's: nothing here adds or subtracts a count,
 * it only writes one down.
 */

/** The most one receipt or count may name (backend `ProductStockService::MAX_UNITS`). */
export const MAX_STOCK_UNITS = 999999;

/** A typed quantity: nothing typed (= not counted), a whole number, or something else. */
export type QuantityInput = { kind: "empty" } | { kind: "ok"; value: number } | { kind: "invalid" };

/**
 * Read a quantity box. Digits only (spaces between thousands allowed: «1 000»),
 * 0 … 999 999 — `min` raises the floor (a receipt is at least 1).
 */
export const parseQuantity = (raw: string, min = 0): QuantityInput => {
  const text = raw.replace(/[\s ]/g, "");
  if (text === "") return { kind: "empty" };
  if (!/^\d+$/.test(text)) return { kind: "invalid" };
  const value = Number(text);
  return value >= min && value <= MAX_STOCK_UNITS ? { kind: "ok", value } : { kind: "invalid" };
};

/** A count as staff read it; below zero with a real minus sign. */
export const stockNumber = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : String(n));

/** A change: «+10», «−3», «0». */
export const signedDelta = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/**
 * What a stock action did, in one line: «5 → 15 (+10)»; from "not counted"
 * «Без учёта → 10»; to it «15 → Без учёта». `notCounted` is the viewer's
 * word for "not counted".
 */
export const stockChangeText = (change: IStockChange, notCounted: string): string => {
  const from = change.before === null ? notCounted : stockNumber(change.before);
  const to = change.after === null ? notCounted : stockNumber(change.after);
  const tail = change.before !== null && change.after !== null && change.delta !== 0 ? ` (${signedDelta(change.delta)})` : "";
  return `${from} → ${to}${tail}`;
};

/**
 * The amber line after a sale that took a counted product below zero:
 * «Остаток ниже нуля: Кола −2, Чипсы −1». `nameOf` turns a product id into
 * the viewer's name for it (the catalogue's translation), else the stored one.
 */
export const stockWarningText = (
  warnings: readonly IStockWarning[],
  template: string,
  nameOf: (id: number) => string | null = () => null,
): string | null => {
  if (warnings.length === 0) return null;
  const parts = warnings.map((w) => `${nameOf(w.product_id) ?? w.name} ${stockNumber(w.stock)}`);
  return fmt(template, parts.join(", "));
};

/** The server's `stock_warnings`, or none (an older backend, or nothing went below zero). */
export const stockWarningsOf = (body: unknown): IStockWarning[] => {
  const list = (body as { stock_warnings?: unknown } | null)?.stock_warnings;
  return Array.isArray(list)
    ? list.filter((w): w is IStockWarning =>
        typeof w === "object" && w !== null && typeof (w as IStockWarning).product_id === "number" && typeof (w as IStockWarning).stock === "number")
    : [];
};
