import { Lang } from "@/i18n/translations";
import { IBranchPlatformPrice } from "@/types/api";
import { KNOWN_PLATFORMS, isKnownPlatform, platformLabel, slugifyPlatform } from "@/utils/platform";

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

/**
 * The platform a name typed under "Other" stands for (2026-10-11): an existing
 * one when the name IS that platform, otherwise the new slug it derives.
 *
 *  1. The slug of the English name, when the branch already has it (pc, ps5,
 *     a place's custom slug, a priced platform) — the slug is the platform's
 *     identity, so this is the same platform whatever its names say.
 *  2. Otherwise the ONE existing platform whose name, in any locale, equals
 *     the text typed in `typedIn` — the box the operator types in. Only that
 *     box: the others are machine translations, and a translation that happens
 *     to equal another platform's name must not re-target a new one.
 *     Exact after trim + lower-case: "PS" is not "PS5", and two platforms
 *     answering to the same name are ambiguous, so neither is chosen.
 *  3. Otherwise the derived slug: a new platform, exactly as before.
 *
 * `existing` is every slug the branch already has; `prices` names the custom
 * ones. Both are the caller's branch data — nothing here is hard-coded but the
 * known three, which the picker always offers.
 */
export const resolveTypedPlatform = (
  names: Record<Lang, string>,
  typedIn: Lang,
  existing: readonly string[],
  prices: readonly Pick<IBranchPlatformPrice, "platform" | "name_en" | "name_ru" | "name_am">[] | undefined,
): string => {
  const slug = slugifyPlatform(names.en.trim());
  if (slug !== "" && (isKnownPlatform(slug) || existing.includes(slug))) return slug;

  const typed = names[typedIn].trim().toLowerCase();
  if (typed === "") return slug;
  const same = (n: string | null | undefined) => (n ?? "").trim().toLowerCase() === typed;
  const hits = new Set<string>([
    ...KNOWN_PLATFORMS.filter((k) => same(platformLabel(k))),
    ...(prices ?? []).filter((p) => p.platform && [p.name_en, p.name_ru, p.name_am].some(same)).map((p) => p.platform),
  ]);
  return hits.size === 1 ? [...hits][0] : slug;
};
