import { ISessionApi } from "@/types/sessions";
import { useMemo } from "react";

export interface ItemAggregate {
  name: string;
  qty: number;
  total: number;
}

export interface SessionsSummary {
  sessionsTotal: number;
  stopped: number;
  active: number;
  /** Closed sessions whose bill was waived. Counted, worth nothing. */
  free: number;
  total: number;
  timeTotal: number;
  itemsTotal: number;
  itemsQty: number;
  topItems: ItemAggregate[];
}

const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/**
 * Pure aggregator. Given a list of sessions (closed, active, expired) it
 * produces the totals + top-items breakdown the history view shows.
 *
 * Splits cleanly out of the route component so:
 *   - The arithmetic is testable in isolation (no React).
 *   - The route stays a pure render layer.
 *   - Future surfaces (e.g. a dashboard widget) can reuse the same numbers.
 *
 * Active sessions still contribute their items to the items totals (cashier
 * has already attached them) but not to the time/total revenue, since
 * `total_paid` only finalizes when the session is stopped.
 *
 * A FREE session contributes to no money figure at all — not its time, not its
 * items. It is still a session and still counted, and what was drunk on it is
 * still in `itemsQty` and the top-items list, because those describe what left
 * the fridge rather than what was earned. Two things this protects:
 *
 *   - `timeTotal` was `total_paid - items`, which for a waived bill is
 *     0 - items, i.e. NEGATIVE. A giveaway would have subtracted itself from
 *     the day's time revenue.
 *   - the three money figures stay consistent with each other: a free session
 *     adds 0 to all of them, so time + items still reconciles with the total.
 */
export const useSessionsSummary = (sessions: ISessionApi[] | null): SessionsSummary => {
  return useMemo(() => aggregateSessionsSummary(sessions ?? []), [sessions]);
};

/**
 * Pure aggregation. Exposed for unit tests so the arithmetic can be
 * verified without spinning up React. The hook above is a thin wrapper.
 */
export const aggregateSessionsSummary = (sessions: ISessionApi[]): SessionsSummary => {
  let total = 0;
  let timeTotal = 0;
  let itemsTotal = 0;
  let itemsQty = 0;
  let stopped = 0;
  let active = 0;
  let free = 0;
  const itemMap = new Map<string, ItemAggregate>();

  for (const s of sessions) {
    const sTotal = num(s.total_paid);
    let sItems = 0;
    let sQty = 0;
    for (const it of s.items ?? []) {
      const line = num(it.price) * num(it.qty);
      sItems += line;
      sQty += num(it.qty);
      const key = it.name ?? "—";
      const prev = itemMap.get(key) ?? { name: key, qty: 0, total: 0 };
      prev.qty += num(it.qty);
      prev.total += line;
      itemMap.set(key, prev);
    }
    const isFree = s.is_free === true;
    itemsQty += sQty;
    if (!isFree) itemsTotal += sItems;

    if (s.status === "stopped" || s.status === "expired") {
      stopped++;
      if (isFree) {
        free++;
      } else {
        total += sTotal;
        // Clamped as well as gated: an older backend that does not send
        // `is_free` would otherwise reach this line with total_paid 0 and a
        // bill full of items, and subtract a giveaway from the day's takings.
        timeTotal += Math.max(0, sTotal - sItems);
      }
    } else {
      active++;
    }
  }

  const topItems = Array.from(itemMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    sessionsTotal: sessions.length,
    stopped,
    active,
    free,
    total,
    timeTotal,
    itemsTotal,
    itemsQty,
    topItems,
  };
};
