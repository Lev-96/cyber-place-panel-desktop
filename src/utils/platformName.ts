import { Lang } from "@/i18n/translations";
import { IBranchPlatformPrice } from "@/types/api";

/**
 * Per-language script guards for the platform-name inputs. Each field accepts
 * ONLY its own alphabet's letters; digits, spaces and punctuation are always
 * allowed (a platform can be "PS4 New"). English is kept pure Latin because its
 * value is the platform identity (its slug is derived from it).
 */
const CYRILLIC = "\\u0400-\\u04FF";
const ARMENIAN = "\\u0531-\\u058F\\uFB13-\\uFB17";
const STRIP: Record<Lang, RegExp> = {
  en: new RegExp(`[${CYRILLIC}${ARMENIAN}]`, "g"), // no Cyrillic, no Armenian
  ru: new RegExp(`[${ARMENIAN}]`, "g"), //           no Armenian
  am: new RegExp(`[${CYRILLIC}]`, "g"), //           no Cyrillic (Russian)
};

/** Remove characters that don't belong to `lang`'s alphabet. */
export const sanitizeForLang = (lang: Lang, value: string): string => value.replace(STRIP[lang], "");

/**
 * Existing platforms whose наименование in ANY locale contains `query`
 * (case-insensitive) — so a match is found no matter which language input the
 * operator types in, and regardless of letter case. Deduplicated by platform
 * slug (a platform appears at most once).
 */
export const matchPlatforms = (
  list: IBranchPlatformPrice[] | undefined,
  query: string,
): IBranchPlatformPrice[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  return (list ?? []).filter((p) => {
    if (seen.has(p.platform)) return false;
    const hit = [p.name_en, p.name_ru, p.name_am].some((n) => (n ?? "").toLowerCase().includes(q));
    if (!hit) return false;
    seen.add(p.platform);
    return true;
  });
};
