import { request } from "./client";

/**
 * Thin REST layer for the desktop auto-update admin flow. The
 * backend contract lives in `cyber-place/app/Http/Controllers/Admin/Updates`
 * and `cyber-place/app/Http/Controllers/Updates`; this file is the
 * single place renderer code talks to those endpoints, so the wire
 * shape only has to be wrangled once.
 *
 *  /admin/updates/check    — current vs latest-on-GitHub per app
 *  /admin/updates/promote  — flip pointer + broadcast `app-updates`
 *  /updates/{app}/manifest — public manifest (read on agents too)
 */

export type AppKind = "panel" | "agent";

export interface CurrentReleaseSummary {
  version: string;
  mandatory: boolean;
  notes: string | null;
  github_tag: string | null;
  published_at: string | null;
  promoted_at: string | null;
}

export interface AvailableReleaseSummary {
  version: string;
  tag: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  html_url: string;
}

export interface UpdateCheckEntry {
  current: CurrentReleaseSummary | null;
  available: AvailableReleaseSummary | null;
  has_update: boolean;
  error: string | null;
}

export type UpdateCheckResponse = Record<AppKind, UpdateCheckEntry>;

export const apiCheckUpdates = async (): Promise<UpdateCheckResponse> => {
  const res = await request<{ data: UpdateCheckResponse }>("/admin/updates/check");
  return res.data;
};

/**
 * Promote the currently latest release for either both apps (default)
 * or a specific subset. Returns the same shape as `check()` so callers
 * can replace their state in one assignment.
 */
export const apiPromoteUpdates = async (
  apps?: AppKind[],
  mandatory?: boolean,
): Promise<UpdateCheckResponse> => {
  const res = await request<{ data: UpdateCheckResponse }>("/admin/updates/promote", {
    method: "POST",
    body: { apps, mandatory },
  });
  return res.data;
};
