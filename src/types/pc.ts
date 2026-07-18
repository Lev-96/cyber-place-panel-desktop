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
