/**
 * Domain vocabulary for a gaming device — the client-side mirror of the
 * backend `App\Enums\PcKind` / `App\Enums\PcStatus`. Components compare against
 * these constants / helpers instead of bare "ps" / "offline" string literals,
 * so the closed set lives in ONE place and a future device type or status is a
 * single-file edit rather than a grep-and-miss across the UI.
 *
 * NOTE: `PcKind` ("pc" | "ps") is the *device* kind and is distinct from
 * `PlatformType` ("pc" | "ps4" | "ps5") which describes a *place's* platform —
 * they overlap on "pc" but are different domains; do not conflate them.
 */
export type PcKind = "pc" | "ps";

export const PC_KIND = {
  Pc: "pc",
  Ps: "ps",
} as const satisfies Record<string, PcKind>;

export type PcStatus = "online" | "offline" | "in_session";

export const PC_STATUS = {
  Online: "online",
  Offline: "offline",
  InSession: "in_session",
} as const satisfies Record<string, PcStatus>;

/**
 * Status-dot palette (single source of truth for the sessions board + device
 * list): online = green (available), offline = red (agent not connected),
 * in_session = amber (busy). Billing-only devices are always online → green.
 */
export const PC_STATUS_COLOR: Record<PcStatus, string> = {
  online: "#22c55e",
  offline: "#ef4444",
  in_session: "#f59e0b",
};

/** A PC runs the kiosk agent; a PS/console does not (billing-only). */
export const pcHasAgent = (kind?: PcKind): boolean => kind === PC_KIND.Pc;

/** Convenience predicate for the common "is this a console?" branch. */
export const isPs = (kind?: PcKind): boolean => kind === PC_KIND.Ps;

/**
 * The minimum a device has to expose for the availability rules below — so
 * they work on an `IPcApi` row, on a realtime patch, or on a test fixture
 * without any of them having to import the full API shape.
 */
export interface DeviceAvailabilityLike {
  kind?: PcKind;
  status: PcStatus;
  /**
   * Server verdict (`PcResource.is_startable`). Present since the backend
   * started owning the rule; kept optional so an older backend (or a
   * partially-built fixture) degrades to the local fallback below instead
   * of blocking every device.
   */
  is_startable?: boolean;
}

/**
 * Availability as it should be SHOWN, mirroring `App\Models\Pcs\Pc::effectiveStatus()`.
 *
 * The backend already sends the effective value; this is the client-side
 * safety net for rows that predate it (or arrive from a cached response):
 * a console has no kiosk agent to ever report in, so an `offline` row on it
 * is meaningless and must never render as "not connected".
 */
export const effectivePcStatus = (pc: DeviceAvailabilityLike): PcStatus =>
  isPs(pc.kind) && pc.status === PC_STATUS.Offline ? PC_STATUS.Online : pc.status;

/**
 * May a session be started on this device right now?
 *
 * An offline computer (agent never paired, or its heartbeat went stale) is not
 * reachable: the kiosk would never unlock for the player, so billing it is
 * always wrong. The server is authoritative — `is_startable` wins whenever it
 * is present; otherwise we re-derive the same rule from the effective status.
 *
 * NOTE: this answers "is the DEVICE available", not "is the seat free" —
 * a running session or a booking reservation is a separate, caller-side check.
 */
export const isDeviceStartable = (pc: DeviceAvailabilityLike): boolean =>
  pc.is_startable ?? effectivePcStatus(pc) !== PC_STATUS.Offline;
