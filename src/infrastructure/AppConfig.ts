export const AppConfig = {
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000",
  realtimePollIntervalMs: 8_000,
  realtimePollIdleMs: 30_000,
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
