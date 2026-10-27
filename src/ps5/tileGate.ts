import type { MachineState } from "./machine";

/**
 * What the Start and Stop buttons of a PlayStation seat may do while its
 * console is changing state (2026-10-19, the owner's rule).
 *
 * A console takes seconds to fall asleep and to boot. A second press in that
 * time was the source of "it only worked the second time": Start pressed while
 * the console was still going to sleep, Stop pressed while it was still
 * booting. So while the console is on its way the button says where it is
 * going and cannot be pressed:
 *
 * - seat free, console going to rest → Start disabled, "Going to sleep…";
 * - session running, console waking   → Stop disabled, "Turning on…".
 *
 * Bounded on its own (2026-10-28): the lock lasts at most `START_LOCK_MS` from
 * when the sleep began and `STOP_LOCK_MS` from when the waking began — the
 * bounds the floor was given — whatever the machine keeps waiting for after
 * that (a console on poor Wi-Fi may take minutes to sleep; the machine keeps
 * resting it, but the seat is not held hostage). A seat with no console, or a
 * panel with no desktop bridge, has no lifecycle and is not gated.
 */
export const START_LOCK_MS = 30_000;
export const STOP_LOCK_MS = 45_000;

export interface TileGate {
  disabled: boolean;
  /** The label to show instead of Start/Stop, or null to keep it. */
  labelKey: string | null;
}

const OPEN: TileGate = { disabled: false, labelKey: null };

/** Whether a transition that began at `since` is still young enough to lock a button. */
const young = (since: number | null | undefined, now: number, limit: number): boolean =>
  since === null || since === undefined || now - since < limit;

/** @param restingSince when the sleep began (the machine's snapshot), if known. */
export const startGate = (lifecycle: MachineState | undefined, restingSince?: number | null, now = Date.now()): TileGate =>
  lifecycle === "GOING_TO_REST" && young(restingSince, now, START_LOCK_MS)
    ? { disabled: true, labelKey: "ps5.gate.goingToRest" } : OPEN;

/** @param wakingSince when the waking began (the machine's snapshot), if known. */
export const stopGate = (lifecycle: MachineState | undefined, wakingSince?: number | null, now = Date.now()): TileGate =>
  lifecycle === "WAKING" && young(wakingSince, now, STOP_LOCK_MS)
    ? { disabled: true, labelKey: "ps5.gate.waking" } : OPEN;
