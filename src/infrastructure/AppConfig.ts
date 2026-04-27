export const AppConfig = {
  backendUrl: import.meta.env.VITE_BACKEND_URL ?? "https://cyber-place-server-staging-production.up.railway.app",
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
