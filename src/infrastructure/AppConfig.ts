export const AppConfig = {
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000",
  // Polling cadence used by `RealtimeService` for the BranchLive tile
  // grid. Reverb is the primary realtime path (sub-second delta
  // delivery) — these intervals only run as a sanity fallback for the
  // rare case the WebSocket drops silently. The legacy 8s active /
  // 30s idle values dated from before the Reverb integration and put
  // a single staff session at ~37 reqs/min just on this screen,
  // routinely tripping the `api` rate limiter (60/min user) once the
  // cashier also had Sessions / Notifications / Home open. 30s
  // active + 60s idle keep recovery snappy without competing with
  // Reverb deltas. The backend `RouteServiceProvider` rate limit was
  // raised in lockstep to 300/min so a brief polling burst from
  // multiple tabs doesn't 429.
  realtimePollIntervalMs: 30_000,
  realtimePollIdleMs: 60_000,
  realtimePollMaxBackoffMs: 60_000,
  defaultCommissionPercent: 1,
  storageKeys: {
    token: "cp.token",
    role: "cp.role",
    user: "cp.user",
    commissionByCompany: "cp.commissionByCompany",
  },
} as const;

/**
 * Resolve a Laravel-stored relative path (e.g. `images/company/logos/x.png`)
 * to a full URL the renderer can load (`${backend}/storage/${path}`).
 */
export const storageUri = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = AppConfig.backendUrl.replace(/\/$/, "");
  const clean = path.replace(/^\/+/, "");
  return `${base}/storage/${clean}`;
};
