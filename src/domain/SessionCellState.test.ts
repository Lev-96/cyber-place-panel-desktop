import { describe, expect, it } from "vitest";
import {
  canStartSession,
  resolveSessionCellState,
  SESSION_CELL_COLOR,
} from "./SessionCellState";
import { DeviceAvailabilityLike, PC_KIND, PC_STATUS, PC_STATUS_COLOR } from "@/types/pc";

/**
 * Regression shield for the user-reported bug: places whose computer was
 * offline showed «Свободно» on the sessions board and their Start button
 * worked, so a session could be opened on an unreachable machine.
 */

const online: DeviceAvailabilityLike = { kind: PC_KIND.Pc, status: PC_STATUS.Online };
const offline: DeviceAvailabilityLike = { kind: PC_KIND.Pc, status: PC_STATUS.Offline };
const console_: DeviceAvailabilityLike = { kind: PC_KIND.Ps, status: PC_STATUS.Offline };

describe("resolveSessionCellState", () => {
  it("reports a free seat on a reachable device as free", () => {
    expect(resolveSessionCellState({ hasSession: false, isReserved: false, device: online })).toBe("free");
  });

  it("never reports an offline device as free", () => {
    expect(resolveSessionCellState({ hasSession: false, isReserved: false, device: offline })).toBe("offline");
  });

  it("prefers offline over reserved — the cashier cannot act on the booking either", () => {
    expect(resolveSessionCellState({ hasSession: false, isReserved: true, device: offline })).toBe("offline");
  });

  it("keeps a running session visible even if the agent dropped", () => {
    expect(resolveSessionCellState({ hasSession: true, isReserved: false, device: offline })).toBe("busy");
  });

  it("still shows reservations on reachable devices", () => {
    expect(resolveSessionCellState({ hasSession: false, isReserved: true, device: online })).toBe("reserved");
  });

  it("treats a billing-only console as reachable (it has no agent)", () => {
    expect(resolveSessionCellState({ hasSession: false, isReserved: false, device: console_ })).toBe("free");
  });

  it("honours the server verdict when the status column lies", () => {
    const staleHeartbeat: DeviceAvailabilityLike = { ...online, is_startable: false };
    expect(resolveSessionCellState({ hasSession: false, isReserved: false, device: staleHeartbeat })).toBe("offline");
  });
});

describe("canStartSession", () => {
  it("offers Start only for a free seat on an available device", () => {
    expect(canStartSession("free")).toBe(true);
    expect(canStartSession("offline")).toBe(false);
    expect(canStartSession("reserved")).toBe(false);
    expect(canStartSession("busy")).toBe(false);
  });
});

describe("SESSION_CELL_COLOR", () => {
  it("paints an offline tile with the device palette's offline colour", () => {
    expect(SESSION_CELL_COLOR.offline).toBe(PC_STATUS_COLOR.offline);
  });

  it("covers every state", () => {
    for (const state of ["busy", "offline", "reserved", "free"] as const) {
      expect(SESSION_CELL_COLOR[state]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
