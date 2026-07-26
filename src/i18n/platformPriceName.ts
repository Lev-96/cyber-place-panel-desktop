import { IBranchPlatformPrice } from "@/types/api";
import { Lang } from "@/i18n/translations";

/**
 * Resolve a custom-platform price's display наименование for the active UI
 * language, with deterministic fallback: requested locale → English → Russian
 * → Armenian → empty. Same rule as {@link timePackageNameOf}, so no render
 * site shows a blank because one locale column is empty.
 */
export const platformPriceNameOf = (
  p: Pick<IBranchPlatformPrice, "name_en" | "name_ru" | "name_am">,
  lang: Lang,
): string => {
  const map = { en: p.name_en, ru: p.name_ru, am: p.name_am } as const;
  return map[lang] || p.name_en || p.name_ru || p.name_am || "";
};
