import { describe, expect, test } from "vitest";
import type { MachineState } from "./machine";
import { startGate, stopGate } from "./tileGate";

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
});
