import { apiGetPreferences, apiPutPreferences, type IUserPreferencesDoc } from "@/api/preferences";

/**
 * The person's interface preferences (2026-10-27). Not wrapped in a fallback:
 * a failed read must stay a failure so the provider can keep its cached copy
 * instead of mistaking "no answer" for "no preferences".
 */
export class PreferencesRepository {
  get(): Promise<IUserPreferencesDoc> {
    return apiGetPreferences().then((r) => r.preferences);
  }
  put(body: { schema_version: number; data: unknown; onboarding_version?: number }): Promise<IUserPreferencesDoc> {
    return apiPutPreferences(body).then((r) => r.preferences);
  }
}

export const preferencesRepository = new PreferencesRepository();
