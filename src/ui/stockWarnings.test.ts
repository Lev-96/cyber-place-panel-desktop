import { afterEach, describe, expect, it, vi } from "vitest";

/** The amber line after a sale below zero (2026-11-16) — and nothing otherwise. */
const toasts = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/ui/notify", () => ({ notify: { warning: (...a: unknown[]) => toasts.warning(...a) } }));
vi.mock("@/i18n/translations", async (orig) => ({ ...(await orig<object>()), tActive: (k: string) => (k === "stock.warnBelowZero" ? "Below zero: {0}." : k) }));

import { announceStockWarnings } from "./stockWarnings";

afterEach(() => toasts.warning.mockReset());

describe("announceStockWarnings", () => {
  it("raises one amber toast naming every product below zero", () => {
    announceStockWarnings({ order: { id: 1 }, stock_warnings: [{ product_id: 1, name: "Cola", stock: -2 }, { product_id: 2, name: "Chips", stock: -1 }] });
    expect(toasts.warning).toHaveBeenCalledTimes(1);
    expect(toasts.warning).toHaveBeenCalledWith("Below zero: Cola −2, Chips −1.");
  });

  it("says nothing for an answer without warnings (an older backend, or nothing below zero)", () => {
    announceStockWarnings({ order: { id: 1 } });
    announceStockWarnings({ session: {}, stock_warnings: [] });
    expect(toasts.warning).not.toHaveBeenCalled();
  });
});
