import { IBranchPlatformPrice } from "@/types/api";
import { Lang } from "@/i18n/translations";
import { pickLocale } from "@/i18n/translated";
import { compareText } from "@/i18n/collation";
import { KNOWN_PLATFORMS, isKnownPlatform, platformLabel } from "@/utils/platform";

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

type PriceRow = Pick<IBranchPlatformPrice, "platform" | "name_en" | "name_ru" | "name_am">;

/** One platform a branch can be put on, ready to draw: its slug and the name staff read. */
export interface BranchPlatformOption {
  slug: string;
  label: string;
  /** pc / ps4 / ps5: first-class behaviour (tariff matrix, kiosk agent). */
  known: boolean;
}

/**
 * Name and order a set of slugs: pc/ps4/ps5 first in their canonical order
 * (always present), then every distinct custom slug sorted by its display name
 * in the panel language. Blank slugs are dropped; nothing is invented.
 */
const optionsOf = (
  slugs: readonly (string | null | undefined)[],
  prices: readonly PriceRow[] | undefined,
  lang: Lang,
): BranchPlatformOption[] => {
  const customs = Array.from(new Set(
    slugs.map((s) => (s ?? "").trim()).filter((s) => s !== "" && !isKnownPlatform(s)),
  ))
    .map((slug) => ({ slug, label: platformDisplayNameOf(slug, prices, lang), known: false }))
    .sort((a, b) => compareText(a.label, b.label, lang) || a.slug.localeCompare(b.slug));
  return [
    ...KNOWN_PLATFORMS.map((slug) => ({ slug, label: platformLabel(slug), known: true })),
    ...customs,
  ];
};

/**
 * Every platform THIS branch can put a seat, a game or a tariff on — the single
 * list every platform picker draws from (2026-10-09).
 *
 * The branch's platforms are its places' slugs plus its price rows (a priced
 * platform can exist before any place uses it). `extra` keeps one more slug on
 * the list — the saved value of the record being edited — so opening an old
 * record never shows a blank or silently re-targets it.
 *
 * Scope is the caller's job: always this branch's own data, never the global
 * games catalogue (another company's custom platform must not appear here).
 */
export const branchPlatformOptions = (
  placeSlugs: readonly (string | null | undefined)[],
  prices: readonly PriceRow[] | undefined,
  lang: Lang,
  extra?: string | null,
): BranchPlatformOption[] =>
  optionsOf([...placeSlugs, ...(prices ?? []).map((p) => p.platform), extra], prices, lang);

/**
 * Custom platforms as quick-pick buttons (2026-10-08), shared by GameForm and
 * PlaceForm: the custom part of {@link branchPlatformOptions} over exactly the
 * slugs given (a price row only NAMES a slug here, it does not add one). The
 * CALLER decides which slugs are in scope — always this branch's own, never
 * another company's.
 */
export const customPlatformOptions = (
  slugs: readonly (string | null | undefined)[],
  prices: readonly PriceRow[] | undefined,
  lang: Lang,
): { slug: string; label: string }[] =>
  optionsOf(slugs, prices, lang)
    .filter((o) => !o.known)
    .map(({ slug, label }) => ({ slug, label }));
