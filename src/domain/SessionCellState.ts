import { DeviceAvailabilityLike, isDeviceStartable } from "@/types/pc";
import type { StatusTone } from "./statusTone";

/**
 * What a single tile of the sessions board is showing.
 *
 * Two independent facts decide it and they must not be conflated:
 *   - is the SEAT taken (a running session, or a booking holding it), and
 *   - is the DEVICE reachable (kiosk agent connected — see `isDeviceStartable`).
 *
 * The board used to look at the seat only, so a place whose computer was
 * offline rendered as «Свободно» with a working Start button and the cashier
 * could open a session on a machine nobody could unlock. Keeping the rule in
 * one pure function means the tile, its colour and the Start button can never
 * disagree again — and any future surface (live screen, kiosk dashboard) can
 * reuse the exact same verdict.
 */
export type SessionCellState = "busy" | "offline" | "reserved" | "free";

export interface SessionCellInput {
  /** A session is currently running on this device. */
  hasSession: boolean;
  /** A confirmed booking is holding this device's place. */
  isReserved: boolean;
  /** The device itself (kind + status, plus the server's `is_startable`). */
  device: DeviceAvailabilityLike;
}

/**
 * Precedence, most specific first:
 *   1. `busy`     — a session is running; that is the whole truth of the tile
 *                   (an agent that dropped mid-session must not hide the timer).
 *   2. `offline`  — the device can't be started, so say why instead of "free";
 *                   more actionable than a reservation the cashier can't act on.
 *   3. `reserved` — free device, but a booking is holding the seat.
 *   4. `free`     — available for a walk-in.
 */
export const resolveSessionCellState = ({
  hasSession,
  isReserved,
  device,
}: SessionCellInput): SessionCellState => {
  if (hasSession) return "busy";
  if (!isDeviceStartable(device)) return "offline";
  if (isReserved) return "reserved";
  return "free";
};

/** Start is offered for exactly one state — an available device on a free seat. */
export const canStartSession = (state: SessionCellState): boolean => state === "free";

/**
 * Each state's tone in the shared vocabulary (2026-10-27): free is cyan,
 * playing green, booked violet, offline grey — the same words and colours the
 * places and live boards use (`domain/statusTone.ts`).
 */
export const SESSION_CELL_TONE: Record<SessionCellState, StatusTone> = {
  busy: "playing",
  offline: "offline",
  reserved: "booked",
  free: "free",
};

/** Tile border / status colour per state: its tone's full colour. */
export const SESSION_CELL_COLOR: Record<SessionCellState, string> = {
  busy: "rgb(var(--status-playing-rgb))",
  offline: "rgb(var(--status-offline-rgb))",
  reserved: "rgb(var(--status-booked-rgb))",
  free: "rgb(var(--status-free-rgb))",
};
