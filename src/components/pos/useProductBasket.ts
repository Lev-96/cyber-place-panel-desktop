import { useEffect, useMemo, useRef, useState } from "react";
import { IResolvedItems } from "@/api/sessions";
import { productRepository } from "@/repositories/ProductRepository";
import { IProduct } from "@/types/pos";

/** A line the cashier has selected but not yet confirmed. */
export interface CartLine {
  /** Stable within the dialog: the product id, or the typed name + price. */
  key: string;
  product_id?: number;
  name: string;
  price: number;
  qty: number;
}

interface Options {
  branchId: number;
  /**
   * Read typed lines against the catalogue, writing nothing — the session's
   * `/sessions/{id}/items/resolve` or the till's `/orders/resolve`. Both answer
   * with the one backend `ProductTextResolver`, so "20 lays" means the same on
   * a seat's bill and at the counter.
   */
  resolve: (text: string) => Promise<IResolvedItems>;
  /**
   * What the reader is about (the session id, the branch). The debounced read
   * restarts when it changes; `resolve` itself is held in a ref, because an
   * inline callback is a new function on every render and would restart the
   * debounce forever.
   */
  resolveKey: string | number;
  /** Products this basket may offer — the session hides chips off a poker table. */
  allow?: (product: IProduct) => boolean;
}

/**
 * The basket both sale dialogs share (2026-09-24): the branch catalogue and
 * its search, the local cart and its counts, and the quick-entry box read by
 * the server as the cashier types. Extracted verbatim from the session's
 * AddSessionItemDialog; what the confirmed basket is FOR — a seat's bill, or
 * a sale at the till — stays with each dialog.
 *
 * Nothing here writes: choosing, counting and typing are a decision in
 * progress, and one request carries the whole basket when it is confirmed.
 */
export const useProductBasket = ({ branchId, resolve, resolveKey, allow }: Options) => {
  const [products, setProducts] = useState<IProduct[] | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  /**
   * Which way the cashier is adding things. `picker` is the way the dialog
   * opens; `text` is the shortcut for an order of five things, where finding
   * each one in a list is the slow part. Each mode keeps its state across a
   * switch.
   */
  const [mode, setMode] = useState<"picker" | "text">("picker");
  const [text, setText] = useState("");
  const [resolved, setResolved] = useState<IResolvedItems | null>(null);
  const [resolving, setResolving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const resolveRef = useRef(resolve);
  useEffect(() => { resolveRef.current = resolve; }, [resolve]);

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

  /**
   * A product that now exists everywhere, and is in the basket besides.
   *
   * Two steps that cannot be one: the product is a row of its own, the basket
   * is a decision not yet committed. The catalogue keeps the product whatever
   * happens to the basket next, and nothing is sold until the cashier
   * confirms it.
   */
  const onProductCreated = (p: IProduct) => {
    setCreating(false);
    setProducts((prev) => (prev ? [p, ...prev.filter((x) => x.id !== p.id)] : [p]));
    put({ key: `p:${p.id}`, product_id: p.id, name: p.name, price: Number(p.price) });
    setErr(null);
  };

  /**
   * Reads the box as the cashier types, 400ms after they stop.
   *
   * One request per pause rather than one per line, and it writes nothing —
   * the server is only being asked which products these words are. An empty
   * box asks nothing at all.
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
      resolveRef.current(typed)
        .then((r) => {
          if (dropped) return;
          // A 200 is not a promise about the shape. An older backend without
          // this endpoint, a proxy that rewrote the body, a deploy half-way
          // through — any of them can answer something that is not a reading
          // of the box, and reaching into it would take the screen down.
          const readable = Array.isArray(r?.lines);
          setResolved(readable ? r : null);
          // Empty string, not a translated sentence: `t` inside this effect
          // would have to join its dependency list, and a `t` that is a new
          // function on every render restarts the debounce forever. The
          // render turns an empty reason into the generic one.
          setErr(readable ? null : "");
        })
        .catch((e) => {
          if (dropped) return;
          setResolved(null);
          // The server's own sentence is kept as it came (see above on `t`).
          setErr(e instanceof Error && e.message ? e.message : null);
        })
        .finally(() => { if (!dropped) setResolving(false); });
    }, 400);

    return () => { dropped = true; clearTimeout(timer); };
  }, [mode, text, resolveKey]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sellable = (products ?? []).filter((p) => !allow || allow(p));
    if (!needle) return sellable;
    return sellable.filter((p) => `${p.name} ${p.category ?? ""}`.toLowerCase().includes(needle));
  }, [products, search, allow]);

  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.qty, 0);

  return {
    products, search, setSearch, filtered,
    cart, setCart, put, step, drop, cartTotal,
    mode, setMode, text, setText, resolved, setResolved, resolving,
    err, setErr,
    creating, setCreating, onProductCreated,
    loading: products === null,
  };
};

export type ProductBasket = ReturnType<typeof useProductBasket>;
