import { bcp47 } from "@/i18n/collation";
import type { Lang } from "@/i18n/translations";

/**
 * Country names for ISO 3166-1 alpha-2 codes, in the panel's language.
 *
 * The server sends codes only; naming them is the platform's job
 * (`Intl.DisplayNames`). The panel's Armenian code is `am`, which is NOT the
 * BCP-47 tag for Armenian — that is `hy` — so it goes through `bcp47`. A
 * runtime without `Intl.DisplayNames`, or a code it does not know,
 * falls back to the code itself, never to an empty cell.
 */

const cache = new Map<Lang, Intl.DisplayNames | null>();

const displayNames = (lang: Lang): Intl.DisplayNames | null => {
  if (!cache.has(lang)) {
    let names: Intl.DisplayNames | null = null;
    try {
      names = typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames([bcp47(lang)], { type: "region" })
        : null;
    } catch {
      names = null;
    }
    cache.set(lang, names);
  }
  return cache.get(lang) ?? null;
};

export const countryName = (code: string, lang: Lang): string => {
  const upper = code.toUpperCase();
  try {
    return displayNames(lang)?.of(upper) ?? upper;
  } catch {
    // `of()` throws a RangeError on a malformed code.
    return upper;
  }
};

/** "Armenia (AM)" — the name to read, the code to be certain. */
export const countryLabel = (code: string, lang: Lang): string => {
  const upper = code.toUpperCase();
  const name = countryName(upper, lang);
  return name === upper ? upper : `${name} (${upper})`;
};

export { bcp47 as displayLocaleOf };
