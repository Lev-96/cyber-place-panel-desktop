import type { Lang } from "@/i18n/translations";

/**
 * The panel's language as a BCP-47 tag for `Intl`. The panel's Armenian code
 * is `am`, which `Intl` reads as AMHARIC; Armenian is `hy`. Every `Intl` call
 * that takes the panel's language goes through here.
 */
export const bcp47 = (lang: Lang): string => (lang === "am" ? "hy" : lang);

const collators = new Map<string, Intl.Collator>();

/** Alphabetical order in the panel's language (Armenian letters in Armenian order). */
export const compareText = (a: string, b: string, lang: Lang): number => {
  const tag = bcp47(lang);
  let collator = collators.get(tag);
  if (!collator) {
    collator = new Intl.Collator(tag, { sensitivity: "base", numeric: true });
    collators.set(tag, collator);
  }
  return collator.compare(a, b);
};
