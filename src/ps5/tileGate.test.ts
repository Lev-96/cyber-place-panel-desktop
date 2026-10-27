import { describe, expect, test } from "vitest";
import type { MachineState } from "./machine";
import { START_LOCK_MS, STOP_LOCK_MS, startGate, stopGate } from "./tileGate";

const ALL: Array<MachineState | undefined> = [
  undefined, "UNKNOWN", "OFFLINE", "REST", "WAKING", "ACTIVE", "GOING_TO_REST", "UNEXPECTED_WAKE", "ERROR",
];

describe("the PlayStation seat's buttons while its console changes state (2026-10-19)", () => {
  test("Start is locked only while the console is going to sleep", () => {
    for (const s of ALL) {
      expect(startGate(s).disabled, String(s)).toBe(s === "GOING_TO_REST");
    }
    expect(startGate("GOING_TO_REST").labelKey).toBe("ps5.gate.goingToRest");
  });

  test("Stop is locked only while the console is turning on", () => {
    for (const s of ALL) {
      expect(stopGate(s).disabled, String(s)).toBe(s === "WAKING");
    }
    expect(stopGate("WAKING").labelKey).toBe("ps5.gate.waking");
  });

  test("a console that failed, vanished or was never seen never locks a seat", () => {
    for (const s of [undefined, "UNKNOWN", "OFFLINE", "ERROR"] as const) {
      expect(startGate(s)).toEqual({ disabled: false, labelKey: null });
      expect(stopGate(s)).toEqual({ disabled: false, labelKey: null });
    }
  });

  test("the lock is short whatever the console does (2026-10-28): Start ≤ 30 s, Stop ≤ 45 s", () => {
    const t0 = 1_000_000;
    expect(startGate("GOING_TO_REST", t0, t0 + START_LOCK_MS - 1).disabled).toBe(true);
    expect(startGate("GOING_TO_REST", t0, t0 + START_LOCK_MS).disabled).toBe(false);
    expect(stopGate("WAKING", t0, t0 + STOP_LOCK_MS - 1).disabled).toBe(true);
    expect(stopGate("WAKING", t0, t0 + STOP_LOCK_MS).disabled).toBe(false);
  });
});
