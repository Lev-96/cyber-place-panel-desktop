import { IBranchPlatformPrice } from "@/types/api";
import { Lang } from "@/i18n/translations";
import { pickLocale } from "@/i18n/translated";

/**
 * Resolve a custom-platform price's display наименование for the active UI
 * language, with deterministic fallback: requested locale → English → Russian
 * → Armenian → empty.
 *
 * Like tariffs, platform prices still carry the legacy three-column shape
 * instead of the auto-translated `i18n` bag; this adapter bridges them onto the
 * shared rule in {@link pickLocale}, so no render site shows a blank because
 * one locale column is empty — and migrating this entity later cannot change
 * what staff see.
 */
export const platformPriceNameOf = (
  p: Pick<IBranchPlatformPrice, "name_en" | "name_ru" | "name_am">,
  lang: Lang,
): string =>
  pickLocale({ en: p.name_en, ru: p.name_ru, am: p.name_am }, lang) ?? "";
