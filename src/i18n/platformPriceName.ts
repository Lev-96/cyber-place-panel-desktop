import { IBranchPlatformPrice } from "@/types/api";
import { Lang } from "@/i18n/translations";
import { pickLocale } from "@/i18n/translated";
import { isKnownPlatform, platformLabel } from "@/utils/platform";

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

/**
 * Display name of ANY platform slug: pc/ps4/ps5 as their fixed labels, a
 * custom slug as its branch наименование in the active language when the
 * branch has a price row for it, otherwise the de-slugged slug
 * ("table-tennis" → "Table Tennis").
 */
export const platformDisplayNameOf = (
  slug: string,
  prices: readonly Pick<IBranchPlatformPrice, "platform" | "name_en" | "name_ru" | "name_am">[] | undefined,
  lang: Lang,
): string => {
  if (isKnownPlatform(slug)) return platformLabel(slug);
  const row = (prices ?? []).find((p) => p.platform === slug);
  return (row && platformPriceNameOf(row, lang)) || platformLabel(slug);
};

/**
 * Custom platforms as quick-pick buttons (2026-10-08), shared by GameForm and
 * PlaceForm: the distinct non-pc/ps4/ps5 slugs, each named in the active
 * language (the branch наименование when it has a price row, else the
 * de-slugged slug), sorted by that name. The CALLER decides which slugs are
 * in scope — always this branch's own, never another company's.
 */
export const customPlatformOptions = (
  slugs: readonly (string | null | undefined)[],
  prices: readonly Pick<IBranchPlatformPrice, "platform" | "name_en" | "name_ru" | "name_am">[] | undefined,
  lang: Lang,
): { slug: string; label: string }[] =>
  Array.from(new Set(slugs.filter((s): s is string => !!s && !isKnownPlatform(s))))
    .map((slug) => ({ slug, label: platformDisplayNameOf(slug, prices, lang) }))
    .sort((a, b) => a.label.localeCompare(b.label));
