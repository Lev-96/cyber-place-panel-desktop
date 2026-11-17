import { isPriceAction, isStockAction, type IProductEvent, type ProductEventValues } from "@/types/productEvents";
import { signedDelta, stockNumber } from "./stock";

/** One "old → new" line of an audit row. `field` is set only when a row changed several. */
export interface ChangeLine {
  field?: string;
  from: string;
  to: string;
  /** Said after the line: a stock change's «(+10)», and how it came in. */
  note?: string;
}

type Formatters = {
  /** The server's decimal string, said in the viewer's currency. */
  price: (amount: string) => string;
  /** A product kind ("regular" / "additional") in words. */
  kind: (kind: string) => string;
  /**
   * An additional item's pricing ("fixed" / "hourly", 2026-11-17) in words.
   * Null is fixed — every item before the choice — so it is said, not dashed.
   */
  pricingMode?: (mode: string | null) => string;
  /** The viewer's word for a stock that is not counted (2026-11-16). */
  notCounted?: string;
  /** How a receipt came in (`via`: create | merge | add) in words, or null to say nothing. */
  via?: (via: string) => string | null;
};

const EMPTY = "-";

/** The actions whose label already says everything: nothing to show as old → new. */
const SELF_EXPLAINED = new Set<IProductEvent["action"]>(["created", "deleted", "activated", "deactivated"]);

const scalar = (v: ProductEventValues[string] | undefined, key: string, f: Formatters): string => {
  if (key === "pricing_mode" && f.pricingMode) return f.pricingMode(v === null || v === undefined || v === "" ? null : String(v));
  if (v === null || v === undefined || v === "") return EMPTY;
  if (key === "kind") return f.kind(String(v));
  if (key === "price") return f.price(String(v));
  return String(v);
};

/**
 * What changed, as the server recorded it — never recomputed here.
 *
 * A price row reads its `old_price` / `new_price` (a first price has no old
 * one, so only the new is shown). A stock row reads `old_stock` / `new_stock`
 * / `stock_delta`: «5 → 15 (+10)», «Без учёта → 10», «15 → Без учёта». Every
 * other edit reads the fields that differ between `before` and `after`; a row
 * that touched several fields (a translation of name and category) names each.
 */
export const describeChange = (e: IProductEvent, f: Formatters): ChangeLine[] => {
  if (isPriceAction(e.action)) {
    if (e.new_price === null && e.old_price === null) return [];
    return [{ from: e.old_price === null ? EMPTY : f.price(e.old_price), to: e.new_price === null ? EMPTY : f.price(e.new_price) }];
  }
  if (isStockAction(e.action)) {
    const notCounted = f.notCounted ?? EMPTY;
    const before = e.old_stock ?? null;
    const after = e.new_stock ?? null;
    const delta = e.stock_delta ?? 0;
    const via = typeof e.after?.via === "string" ? f.via?.(e.after.via) ?? null : null;
    const note = [before !== null && after !== null && delta !== 0 ? `(${signedDelta(delta)})` : null, via].filter(Boolean).join(" · ");
    return [{
      from: before === null ? notCounted : stockNumber(before),
      to: after === null ? notCounted : stockNumber(after),
      ...(note !== "" ? { note } : {}),
    }];
  }
  if (SELF_EXPLAINED.has(e.action)) return [];

  const before = e.before ?? {};
  const after = e.after ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((k) => k !== "is_active" && before[k] !== after[k]);
  return keys.map((k) => ({
    ...(keys.length > 1 ? { field: k } : {}),
    from: scalar(before[k], k, f),
    to: scalar(after[k], k, f),
  }));
};
