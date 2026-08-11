import { request } from "./client";

/**
 * Yandex.Metrica web analytics for the public landing page.
 *
 * The panel never calls Yandex directly — the OAuth token grants read access to
 * every counter on the Yandex account and stays server-side. The backend
 * proxies, caches, and hands back this already-shaped payload.
 *
 * Admin-only: the endpoint sits behind the `admin` guard.
 */

/**
 * Why the section is showing what it is showing. The endpoint always answers
 * 200 — an outage or a missing configuration is a STATE, not an HTTP error —
 * so this discriminates which state to render.
 *
 * - `ok`             — live figures.
 * - `not_configured` — this environment has no counter yet (expected on a
 *                      fresh staging deploy).
 * - `unavailable`    — configured, but Yandex could not be reached.
 */
export type MetrikaStatus = "ok" | "not_configured" | "unavailable";

/** Reporting windows the backend accepts. Mirrors `App\Enums\MetrikaPeriod`. */
export type MetrikaPeriod = "today" | "week" | "month";

export const METRIKA_PERIODS: readonly MetrikaPeriod[] = ["today", "week", "month"] as const;

export interface IMetrikaTotals {
  visits: number;
  users: number;
  /** Percentage 0–100. */
  bounce_rate: number;
  /** Average pages per visit. */
  page_depth: number;
  avg_visit_seconds: number;
}

export interface IMetrikaTrendPoint {
  /** Metrica's own interval start ("YYYY-MM-DD", or an hour for the day view). */
  label: string;
  visits: number;
  users: number;
}

export interface IMetrikaSource {
  source: string;
  visits: number;
  /** Percentage 0–100 of the returned rows' visits. */
  share: number;
}

export interface IMetrikaSummary {
  status: MetrikaStatus;
  period: MetrikaPeriod;
  /** Deep link into Yandex's own interface, or null when unconfigured. */
  dashboard_url: string | null;
  /** True when Yandex estimated rather than counted every visit. */
  sampled: boolean;
  totals: IMetrikaTotals;
  trend: IMetrikaTrendPoint[];
  sources: IMetrikaSource[];
}

export const apiMetrikaSummary = (period: MetrikaPeriod) =>
  request<{ data: IMetrikaSummary }>("/admin/metrika/summary", { params: { period } });
