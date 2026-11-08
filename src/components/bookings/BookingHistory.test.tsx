// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const list = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/repositories/BookingRepository", () => ({ bookingRepository: { listEvents: (...a: unknown[]) => list.fn(...a) } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ t: (k: string) => k, money: String, lang: "en" }) }));

import BookingHistory from "./BookingHistory";

const booking = { id: 7, status: "cancelled", booking_date: "2026-11-07", start_time: "16:00", starts_at: "2026-11-07T16:00:00+04:00",
  ends_at: "2026-11-07T17:00:00+04:00", place_numbers: [4], source: "staff" as const, who: "Арам" };
const ev = (over: Record<string, unknown>) => ({ id: 1, booking_id: 7, branch_id: 3, action: "created", meta: { by: "staff" },
  created_at: "2026-11-07T12:00:00+04:00", user: { id: 2, name: "John", role: "manager" }, booking, ...over });

afterEach(cleanup);

describe("booking history", () => {
  test("asks the branch's steps for the period and says what, which booking, and who", async () => {
    list.fn.mockResolvedValue([
      ev({ id: 3, action: "cancelled", meta: { by: "system", reason: "no_show" }, user: null }),
      ev({ id: 2, action: "updated", meta: { by: "staff", changes: { minutes: { from: 60, to: 90 }, contact: ["contact_phone"] } } }),
      ev({ id: 1 }),
    ]);
    await act(async () => { render(<BookingHistory branchId={3} fromIso="a" toIso="b" refreshKey={0} />); });
    expect(list.fn).toHaveBeenCalledWith({ branch_id: 3, from: "a", to: "b", limit: 1000 });
    const rows = screen.getAllByTestId("booking-history-row");
    expect(rows.map((r) => r.getAttribute("data-action"))).toEqual(["cancelled", "updated", "created"]);
    expect(rows[0].textContent).toContain("bookingHistory.reason.no_show");
    expect(rows[0].textContent).toContain("bookingHistory.bySystem");
    expect(rows[1].textContent).toContain("60 → 90");
    expect(rows[1].textContent).toContain("bookingHistory.field.contact");
    expect(rows[2].textContent).toContain("№4");
    expect(rows[2].textContent).toContain("Арам");
    expect(rows[2].textContent).toContain("John");
  });

  test("nothing in the period says so", async () => {
    list.fn.mockResolvedValue([]);
    await act(async () => { render(<BookingHistory branchId={3} fromIso="a" toIso="b" refreshKey={0} />); });
    expect(screen.getByText("bookingHistory.empty")).toBeTruthy();
  });
});
