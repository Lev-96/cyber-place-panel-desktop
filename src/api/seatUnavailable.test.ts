import { describe, expect, it } from "vitest";
import {
  claimedFromOf,
  offeredMinutesOf,
  seatUnavailableBodyOf,
} from "./seatUnavailable";

const refusal = (over: Record<string, unknown> = {}) => ({
  body: {
    message: "The seat is reserved",
    code: "seat_reserved",
    latest_allowed_end: "2026-09-10T15:00:00+04:00",
    max_minutes: 50,
    ...over,
  },
});

describe("reading the server's seat refusal", () => {
  it("recognises a grant refused by a reservation", () => {
    expect(seatUnavailableBodyOf(refusal())?.code).toBe("seat_reserved");
  });

  it("recognises the unlimited refusal too", () => {
    expect(
      seatUnavailableBodyOf(refusal({ code: "seat_reserved_unlimited" }))?.code,
    ).toBe("seat_reserved_unlimited");
  });

  it("is not fooled by any other refusal", () => {
    expect(seatUnavailableBodyOf({ body: { message: "Session not active" } })).toBeNull();
    expect(seatUnavailableBodyOf({ body: { code: "company_blocked" } })).toBeNull();
    expect(seatUnavailableBodyOf(new Error("network"))).toBeNull();
    expect(seatUnavailableBodyOf(null)).toBeNull();
  });

  it("reads the grant the server would accept", () => {
    expect(offeredMinutesOf(seatUnavailableBodyOf(refusal()))).toBe(50);
  });

  it("offers nothing when the reservation has already started", () => {
    // Zero headroom must not become a "+0 minutes" button.
    expect(offeredMinutesOf(seatUnavailableBodyOf(refusal({ max_minutes: 0 })))).toBeNull();
  });

  it("offers nothing when the server sent no figure", () => {
    expect(offeredMinutesOf(seatUnavailableBodyOf(refusal({ max_minutes: null })))).toBeNull();
    expect(offeredMinutesOf(null)).toBeNull();
  });

  it("never offers a fraction of a minute", () => {
    expect(offeredMinutesOf(seatUnavailableBodyOf(refusal({ max_minutes: 49.9 })))).toBe(49);
  });

  it("reads the moment the seat is claimed", () => {
    const at = claimedFromOf(seatUnavailableBodyOf(refusal()));
    expect(at?.toISOString()).toBe(new Date("2026-09-10T15:00:00+04:00").toISOString());
  });

  it("survives a null or unparseable instant", () => {
    expect(claimedFromOf(seatUnavailableBodyOf(refusal({ latest_allowed_end: null })))).toBeNull();
    expect(claimedFromOf(seatUnavailableBodyOf(refusal({ latest_allowed_end: "soon" })))).toBeNull();
  });
});
