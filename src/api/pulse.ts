import { request } from "./client";

/**
 * Laravel Pulse — the backend's performance/telemetry dashboard.
 *
 * The dashboard is a server-rendered page that authenticates by SESSION
 * cookie, while this panel authenticates with a Sanctum bearer token. It can
 * therefore not be fetched or embedded here; the backend instead mints a
 * ONE-TIME, short-lived entry URL for the calling admin, which we hand to the
 * operating system's browser.
 *
 * Admin-only: the endpoint sits behind the `admin` guard and answers 403 for
 * every other role.
 */
export interface IPulseAccessLink {
  /**
   * Absolute URL to open in an external browser.
   *
   * Carries a single-use credential — never log it, never persist it, never
   * put it in a component's URL/state that survives the navigation.
   */
  url: string;
  /** ISO 8601 instant after which the link stops working. */
  expires_at: string;
  /** Seconds remaining at the moment the server issued it. */
  expires_in: number;
}

/**
 * Mint a fresh entry link. POST (not GET) because it creates credential-bearing
 * state — it must never be pre-fetched or retried automatically.
 */
export const apiIssuePulseAccessLink = () =>
  request<{ data: IPulseAccessLink }>("/admin/pulse/access", { method: "POST" });
