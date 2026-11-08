import { isPriceAction, type IProductEvent, type ProductEventValues } from "@/types/productEvents";

/** One "old → new" line of an audit row. `field` is set only when a row changed several. */
export interface ChangeLine {
  field?: string;
  from: string;
  to: string;
}

type Formatters = {
  /** The server's decimal string, said in the viewer's currency. */
  price: (amount: string) => string;
  /** A product kind ("regular" / "additional") in words. */
  kind: (kind: string) => string;
};

const EMPTY = "-";

/** The actions whose label already says everything: nothing to show as old → new. */
const SELF_EXPLAINED = new Set<IProductEvent["action"]>(["created", "deleted", "activated", "deactivated"]);

const scalar = (v: ProductEventValues[string] | undefined, key: string, f: Formatters): string => {
  if (v === null || v === undefined || v === "") return EMPTY;
  if (key === "kind") return f.kind(String(v));
  if (key === "price") return f.price(String(v));
  return String(v);
};

/**
 * What changed, as the server recorded it — never recomputed here.
 *
 * A price row reads its `old_price` / `new_price` (a first price has no old
 * one, so only the new is shown). Every other edit reads the fields that
 * differ between `before` and `after`; a row that touched several fields (a
 * translation of name and category) names each one.
 */
export const describeChange = (e: IProductEvent, f: Formatters): ChangeLine[] => {
  if (isPriceAction(e.action)) {
    if (e.new_price === null && e.old_price === null) return [];
    return [{ from: e.old_price === null ? EMPTY : f.price(e.old_price), to: e.new_price === null ? EMPTY : f.price(e.new_price) }];
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
