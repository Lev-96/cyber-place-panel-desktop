import { describe, expect, test } from "vitest";
import { ISessionApi } from "@/types/sessions";
import {
  pausedSecondsBetween,
  sessionItemsTotalAt,
  sessionJoysticksTotalAt,
  sessionTimeCostAt,
} from "./sessionAmount";

/**
 * A paused session's figures hold still, and every ticking term leaves out
 * the part of ITS OWN interval that was paused — the mirror of
 * `Session::pausedSecondsBetween()` and the calculator's two terms. The
 * numbers are the backend's own worked example (SessionPauseTest), so a
 * drift between the tile and the receipt fails here.
 */
const at = (hhmm: string): number => Date.parse(`2026-09-23T${hhmm}:00.000Z`);
const iso = (hhmm: string): string => new Date(at(hhmm)).toISOString();

const fixed = (over: Partial<ISessionApi> = {}): ISessionApi => ({
  id: 1,
  mode: "fixed",
  status: "active",
  started_at: iso("14:00"),
  ends_at: iso("15:00"),
  hourly_rate: null,
  committed_amount: 1500,
  total_paid: 1500,
  time_package: { duration_minutes: 60, price: 1500 },
  ...over,
} as ISessionApi);

describe("a paused session's figures", () => {
  test("hold still for the whole pause", () => {
    const session = fixed({ paused_at: iso("14:30"), pauses: [{ paused_at: iso("14:30"), resumed_at: null }] });

    expect(sessionTimeCostAt(session, at("14:30"))).toBe(750);
    expect(sessionTimeCostAt(session, at("14:50"))).toBe(750);
    expect(sessionTimeCostAt(session, at("16:00"))).toBe(750);
  });

  test("continue after resume from where they stopped", () => {
    // 30 played, 20 paused, 10 played = 40 minutes = 1 000.
    const session = fixed({ pauses: [{ paused_at: iso("14:30"), resumed_at: iso("14:50") }] });

    expect(sessionTimeCostAt(session, at("15:00"))).toBe(1000);
  });

  test("leave every one of several pauses out once", () => {
    const session = fixed({
      pauses: [
        { paused_at: iso("14:10"), resumed_at: iso("14:15") },
        { paused_at: iso("14:25"), resumed_at: iso("14:40") },
        { paused_at: iso("14:45"), resumed_at: iso("14:55") },
      ],
    });

    // 65 elapsed − 30 paused = 35 minutes = 875.
    expect(sessionTimeCostAt(session, at("15:05"))).toBe(875);
  });

  test("an open session's meter stops too", () => {
    const session = { ...fixed(), mode: "open", ends_at: null, hourly_rate: 1200,
      pauses: [{ paused_at: iso("14:30"), resumed_at: iso("15:00") }] } as ISessionApi;

    expect(sessionTimeCostAt(session, at("15:30"))).toBe(1200);
  });

  test("a partial answer that only says paused_at is read as one open pause", () => {
    const session = fixed({ paused_at: iso("14:30") });

    expect(sessionTimeCostAt(session, at("14:50"))).toBe(750);
  });

  test("a session never paused is priced exactly as before", () => {
    expect(pausedSecondsBetween(fixed(), at("14:00"), at("15:00"))).toBe(0);
    expect(sessionTimeCostAt(fixed(), at("14:30"))).toBe(750);
  });

  test("hourly pads and extras leave out only the pause they lived through", () => {
    const session = fixed({
      pauses: [{ paused_at: iso("14:30"), resumed_at: iso("14:50") }],
      joysticks: [
        // Out across the pause: 60 − 20 = 40 min at 600 = 400.
        { id: 1, slot: 3, price: 600, is_charged: true, is_hourly: true, started_at: iso("14:10"), stopped_at: null },
        // Out after it: 10 min at 600 = 100.
        { id: 2, slot: 4, price: 600, is_charged: true, is_hourly: true, started_at: iso("15:00"), stopped_at: null },
      ],
      items: [
        // 50 − 20 = 30 min at 300 = 150.
        { id: 9, name: "Кий", price: 300, qty: 1, product_id: null, is_extra: true, is_hourly: true,
          created_at: iso("14:20"), returned_at: null } as NonNullable<ISessionApi["items"]>[number],
      ],
    });

    expect(sessionJoysticksTotalAt(session, at("15:10"))).toBe(500);
    expect(sessionItemsTotalAt(session, at("15:10"))).toBe(150);
    expect(sessionTimeCostAt(session, at("15:10"))).toBe(1250);
  });
});
