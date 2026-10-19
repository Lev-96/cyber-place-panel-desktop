/**
 * The six states a screen can be in besides "showing its data" (loading keeps
 * the skeletons — the player is never a loader). Each maps to a pose and to
 * default copy; a screen overrides the copy with its own context-specific keys
 * ("No branches yet", not "Nothing here") wherever it has them.
 */
export type StateVariant = "empty" | "noResults" | "notFound" | "error" | "offline" | "success";

export interface StateVariantConfig {
  titleKey: string;
  descriptionKey: string;
  /** error / offline interrupt (`alert`); the rest are information (`status`). */
  role: "status" | "alert";
}

export const STATE_VARIANTS = {
  empty: { titleKey: "state.empty.title", descriptionKey: "state.empty.description", role: "status" },
  noResults: { titleKey: "state.noResults.title", descriptionKey: "state.noResults.description", role: "status" },
  notFound: { titleKey: "state.notFound.title", descriptionKey: "state.notFound.description", role: "status" },
  error: { titleKey: "state.error.title", descriptionKey: "state.error.description", role: "alert" },
  offline: { titleKey: "state.offline.title", descriptionKey: "state.offline.description", role: "alert" },
  success: { titleKey: "state.success.title", descriptionKey: "state.success.description", role: "status" },
} as const satisfies Record<StateVariant, StateVariantConfig>;
