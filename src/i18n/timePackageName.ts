import { ITimePackage } from "@/types/sessions";

export type Lang = "en" | "ru" | "am";

/**
 * Resolve a TimePackage's display label for the active UI language,
 * with deterministic fallback: requested locale → English → Russian →
 * Armenian → empty string. Centralised so a future locale addition
 * stays a one-line edit and no render site can show a blank because
 * one column is empty.
 *
 * Mirrors the same approach the cashier dialog uses for branch
 * services (`AddSessionItemDialog.tsx`), kept here so future locale
 * additions stay a one-line edit on both surfaces.
 */
export const timePackageNameOf = (
  pkg: Pick<ITimePackage, "name_en" | "name_ru" | "name_am">,
  lang: Lang,
): string => {
  const map = { en: pkg.name_en, ru: pkg.name_ru, am: pkg.name_am } as const;
  return map[lang] || pkg.name_en || pkg.name_ru || pkg.name_am || "";
};
