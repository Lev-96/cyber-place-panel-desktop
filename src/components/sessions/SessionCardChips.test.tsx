// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ISessionApi } from "@/types/sessions";
import SessionCardChips from "./SessionCardChips";

/**
 * The card's at-a-glance chips of 2026-11-15: «Не оплачено: 1 200» (the
 * server's `unpaid_items_total`), the prepayment (`prepaid_amount`) and the
 * reminder (`reminder.at`). Each is the server's figure; nothing is summed.
 */
const t = (k: string) => (k.endsWith("Chip") ? `${k} {0}` : k);
const money = (n: number) => `${n} AMD`;
const s = (over: Partial<ISessionApi>) => ({ id: 5, status: "active", ...over } as ISessionApi);
const mount = (over: Partial<ISessionApi>) => render(<SessionCardChips session={s(over)} t={t} money={money} />);

afterEach(() => cleanup());

describe("unpaid lines", () => {
  test("the server's unpaid_items_total, amber", () => {
    mount({ unpaid_items_total: 1200 });
    const chip = screen.getByTestId("card-unpaid-chip");
    expect(chip.textContent).toBe("session.unpaidChip 1200 AMD");
  });
  test("nothing at zero, nothing when absent (older backend)", () => {
    mount({ unpaid_items_total: 0 });
    expect(screen.queryByTestId("card-unpaid-chip")).toBeNull();
    cleanup();
    mount({});
    expect(screen.queryByTestId("card-unpaid-chip")).toBeNull();
  });
});

describe("paid ahead", () => {
  test("the server's prepaid_amount, green", () => {
    mount({ prepaid_amount: 2000 });
    expect(screen.getByTestId("card-prepaid-chip").textContent).toBe("session.prepaidChip 2000 AMD");
  });
  test("none when nothing was paid ahead", () => {
    mount({ prepaid_amount: null });
    expect(screen.queryByTestId("card-prepaid-chip")).toBeNull();
  });
  test("unpaid comes first: it is what must be collected", () => {
    mount({ prepaid_amount: 2000, unpaid_items_total: 600 });
    const ids = [...document.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid"));
    expect(ids).toEqual(["card-unpaid-chip", "card-prepaid-chip"]);
  });
});

describe("the reminder", () => {
  test("pending: «🔔 HH:MM», the server's remind time", () => {
    const at = "2026-11-15T16:40:00Z";
    mount({ reminder: { at, set_at: null, minutes: 120, note: "Арам", set_by_user_id: 1, fired_at: null } });
    const chip = screen.getByTestId("card-reminder-chip");
    const hhmm = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(chip.textContent).toBe(`🔔 ${hhmm}`);
    expect(chip.className).not.toContain("is-fired");
    expect(chip.getAttribute("title")).toContain("Арам");
  });
  test("rang: its own look and words", () => {
    mount({ reminder: { at: "2026-11-15T16:40:00Z", set_at: null, minutes: 120, note: null, set_by_user_id: 1, fired_at: "2026-11-15T16:40:05Z" } });
    const chip = screen.getByTestId("card-reminder-chip");
    expect(chip.className).toContain("is-fired");
    expect(chip.textContent).toBe("🔔 session.reminder.chipFired");
  });
  test("the reminder is first: the shortest and the most urgent", () => {
    mount({ unpaid_items_total: 600, reminder: { at: "2026-11-15T16:40:00Z", set_at: null, minutes: 120, note: null, set_by_user_id: 1, fired_at: null } });
    const ids = [...document.querySelectorAll("[data-testid]")].map((e) => e.getAttribute("data-testid"));
    expect(ids).toEqual(["card-reminder-chip", "card-unpaid-chip"]);
  });
});
