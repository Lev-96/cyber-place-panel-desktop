import { ITimePackage } from "@/types/sessions";
import { pickLocale } from "@/i18n/translated";

export type Lang = "en" | "ru" | "am";

/**
 * Resolve a TimePackage's display label for the active UI language,
 * with deterministic fallback: requested locale → English → Russian →
 * Armenian → empty string.
 *
 * Tariffs still use the legacy three-column shape (`name_en/name_ru/name_am`)
 * rather than the auto-translated `i18n` bag, so this adapter bridges the two.
 * The fallback rule itself now lives in {@link pickLocale}, shared with every
 * auto-translated entity — so when tariffs move onto the pipeline, what staff
 * see cannot shift.
 */
export const timePackageNameOf = (
  pkg: Pick<ITimePackage, "name_en" | "name_ru" | "name_am">,
  lang: Lang,
): string =>
  pickLocale({ en: pkg.name_en, ru: pkg.name_ru, am: pkg.name_am }, lang) ?? "";
