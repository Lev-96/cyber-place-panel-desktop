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
 * Bounded by the state machine, never by a timer here: GOING_TO_REST lasts at
 * most `REST_SETTLE_MS` and WAKING at most `WAKE_GIVE_UP_MS`, after which the
 * console is REST / ACTIVE / OFFLINE / ERROR and the button is back. A console
 * that never answers therefore can never lock a seat. A seat with no console,
 * or a panel with no desktop bridge, has no lifecycle and is not gated.
 */
export interface TileGate {
  disabled: boolean;
  /** The label to show instead of Start/Stop, or null to keep it. */
  labelKey: string | null;
}

const OPEN: TileGate = { disabled: false, labelKey: null };

export const startGate = (lifecycle: MachineState | undefined): TileGate =>
  lifecycle === "GOING_TO_REST" ? { disabled: true, labelKey: "ps5.gate.goingToRest" } : OPEN;

export const stopGate = (lifecycle: MachineState | undefined): TileGate =>
  lifecycle === "WAKING" ? { disabled: true, labelKey: "ps5.gate.waking" } : OPEN;
