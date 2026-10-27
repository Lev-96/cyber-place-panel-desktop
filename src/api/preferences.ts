import { request } from "./client";

/** The person's own interface document, as the server keeps it (2026-10-27). */
export interface IUserPreferencesDoc {
  data: unknown;
  schema_version: number;
  onboarding_version: number;
  onboarded_at: string | null;
}

export const apiGetPreferences = () =>
  request<{ preferences: IUserPreferencesDoc }>("/user/preferences");

/** Replaces the whole document; `onboarding_version` only ever moves forward on the server. */
export const apiPutPreferences = (body: { schema_version: number; data: unknown; onboarding_version?: number }) =>
  request<{ preferences: IUserPreferencesDoc }>("/user/preferences", { method: "PUT", body });
