import { describe, expect, it } from "vitest";
import {
  DeviceAvailabilityLike,
  effectivePcStatus,
  isDeviceStartable,
  isPs,
  pcHasAgent,
  PC_KIND,
  PC_STATUS,
} from "./pc";

/**
 * Device availability drives whether the cashier may open (and bill) a
 * session. Pinning it here because the regression it fixes was user-visible:
 * offline places rendered as «Свободно» with a working Start button.
 */

const device = (over: Partial<DeviceAvailabilityLike> = {}): DeviceAvailabilityLike => ({
  kind: PC_KIND.Pc,
  status: PC_STATUS.Online,
  ...over,
});

describe("kind predicates", () => {
  it("only a PC runs the kiosk agent", () => {
    expect(pcHasAgent(PC_KIND.Pc)).toBe(true);
    expect(pcHasAgent(PC_KIND.Ps)).toBe(false);
    expect(pcHasAgent(undefined)).toBe(false);
    expect(isPs(PC_KIND.Ps)).toBe(true);
    expect(isPs(PC_KIND.Pc)).toBe(false);
  });
});

describe("effectivePcStatus", () => {
  it("passes a computer's status through unchanged", () => {
    expect(effectivePcStatus(device({ status: PC_STATUS.Offline }))).toBe(PC_STATUS.Offline);
    expect(effectivePcStatus(device({ status: PC_STATUS.Online }))).toBe(PC_STATUS.Online);
    expect(effectivePcStatus(device({ status: PC_STATUS.InSession }))).toBe(PC_STATUS.InSession);
  });

  it("never reports a console as offline — it has no agent to report in", () => {
    expect(effectivePcStatus(device({ kind: PC_KIND.Ps, status: PC_STATUS.Offline }))).toBe(
      PC_STATUS.Online,
    );
  });

  it("does not mask a console's running session", () => {
    expect(effectivePcStatus(device({ kind: PC_KIND.Ps, status: PC_STATUS.InSession }))).toBe(
      PC_STATUS.InSession,
    );
  });
});

describe("isDeviceStartable", () => {
  it("blocks a computer whose agent is not connected", () => {
    expect(isDeviceStartable(device({ status: PC_STATUS.Offline }))).toBe(false);
  });

  it("allows an online computer", () => {
    expect(isDeviceStartable(device({ status: PC_STATUS.Online }))).toBe(true);
  });

  it("allows a billing-only console even with a legacy offline row", () => {
    expect(isDeviceStartable(device({ kind: PC_KIND.Ps, status: PC_STATUS.Offline }))).toBe(true);
  });

  it("prefers the server verdict over the local fallback", () => {
    // Server knows the heartbeat went stale even though the column says online.
    expect(isDeviceStartable(device({ status: PC_STATUS.Online, is_startable: false }))).toBe(false);
    // …and the other way round: a venue may run without the agent at all.
    expect(isDeviceStartable(device({ status: PC_STATUS.Offline, is_startable: true }))).toBe(true);
  });

  it("falls back to the local rule when the server omits the flag", () => {
    expect(isDeviceStartable({ kind: PC_KIND.Pc, status: PC_STATUS.Offline })).toBe(false);
    expect(isDeviceStartable({ kind: PC_KIND.Pc, status: PC_STATUS.Online })).toBe(true);
  });

  it("treats an in-session device as reachable (busy is not offline)", () => {
    // Whether the SEAT is free is a separate check (active session / booking).
    expect(isDeviceStartable(device({ status: PC_STATUS.InSession }))).toBe(true);
  });
});
