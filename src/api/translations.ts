import { Lang } from "@/i18n/translations";
import { I18nMap, TranslationStatus } from "@/i18n/translated";
import { request } from "./client";

/**
 * Staff translation endpoints.
 *
 * `preview` translates a string that has not been saved anywhere — it backs the
 * multilingual name fields as the user types. `save` stores the per-locale
 * values a user confirmed, after the entity itself has been created or updated.
 *
 * They are separate calls on purpose: the interactive one does no row lookup
 * and no authorisation work, and the write one makes no provider call.
 */

/** Short aliases the API accepts — never a class name. Mirrors TranslationCatalog. */
export type TranslatableEntity =
  | "product"
  | "place"
  | "pc"
  | "service-expense"
  | "tournament"
  | "game"
  | "company"
  | "branch";

export interface TranslationPreviewBody {
  text: string;
  source_locale: Lang;
  targets: Lang[];
  /** Groups identical strings in the translation memory; selects the provider. */
  field_class?: string;
  max_chars?: number;
}

/** Why the whole batch failed. Absent when it did not. */
export type TranslationFailureReason =
  | "not_configured"
  | "auth"
  | "quota"
  | "provider_error";

export interface TranslationPreviewResult {
  translations: Partial<Record<Lang, string>>;
  /**
   * Locales the backend could not produce — provider down, quota exhausted, or
   * the result failed the quality gate. Deliberately NOT filled with the source
   * text: silently echoing the original would put Russian into the English box
   * and look like it worked.
   */
  failed: Lang[];
  /**
   * Set only when the provider itself could not serve the batch. A locale that
   * merely failed the quality gate leaves this null — telling staff to go check
   * the API key over one awkward word would send them down the wrong path.
   */
  reason?: TranslationFailureReason | null;
  /**
   * Seconds until the request is worth repeating. Only ever set together with
   * `quota` — a rate limit is a wait, not a failure, and the field retries
   * itself instead of asking the user to fill three boxes by hand.
   */
  retry_after?: number | null;
}

export const apiPreviewTranslation = (body: TranslationPreviewBody) =>
  request<TranslationPreviewResult>("/translations/preview", { method: "POST", body });

export interface EntityTranslations {
  id: number;
  i18n: I18nMap;
  i18n_status: Record<string, TranslationStatus>;
}

export const apiGetEntityTranslations = (entity: TranslatableEntity, id: number) =>
  request<EntityTranslations>(`/translations/${entity}/${id}`);

export interface SaveEntityTranslationsBody {
  /** The language the user typed in — the one their form showed first. */
  primary_locale: Lang;
  /** field → { locale → value }. Blank locales are ignored, never used to clear. */
  fields: Record<string, Partial<Record<Lang, string>>>;
}

export const apiSaveEntityTranslations = (
  entity: TranslatableEntity,
  id: number,
  body: SaveEntityTranslationsBody,
) => request<EntityTranslations>(`/translations/${entity}/${id}`, { method: "PUT", body });
