/** Wire types for the admin monitoring sections and the reporting client. */

export const TELEMETRY_APPS = ["mobile", "panel", "agent", "website"] as const;
export type TelemetryApp = (typeof TELEMETRY_APPS)[number];

export type TelemetryLevel = "info" | "warn" | "error";

export interface ITelemetryCount {
  label: string;
  value: number;
  share: number;
}

export interface ITelemetryError {
  name: string;
  message: string | null;
  app_version: string | null;
  platform: string | null;
  occurred_at: string;
}

export interface ITelemetryTrendPoint {
  label: string;
  events: number;
  errors: number;
}

export interface ITelemetrySummary {
  status: "ok" | "disabled" | "unavailable";
  app: TelemetryApp;
  period: string;
  last_seen_at: string | null;
  totals: {
    installs: number;
    events: number;
    launches: number;
    errors: number;
    error_rate: number;
  };
  trend: ITelemetryTrendPoint[];
  versions: ITelemetryCount[];
  platforms: ITelemetryCount[];
  screens: ITelemetryCount[];
  recent_errors: ITelemetryError[];
}

/** One event as the client reports it. */
export interface TelemetryEvent {
  event: string;
  name?: string;
  level?: TelemetryLevel;
  app_version?: string;
  platform?: string;
  install_id?: string;
  occurred_at?: string;
  payload?: Record<string, unknown>;
}
