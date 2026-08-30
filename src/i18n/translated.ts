import { Lang } from "@/i18n/translations";

/**
 * Automatic translation of staff-authored content.
 *
 * Owner/Manager types a value ONCE, in their own language; the backend fills in
 * every other UI locale in the background and ships all of them on the entity
 * as an `i18n` bag. Nothing here fetches or decides anything — resolving a bag
 * is a pure lookup, which is exactly why the client can switch language
 * instantly and offline.
 *
 * Adding a fourth language is a backend config edit: the bag simply gains a key
 * and {@link FALLBACK_ORDER} gains one entry. No component changes.
 */

/** One field, in every locale the backend knows. A locale may be null while its translation is still being produced. */
export type I18nBag = Record<string, string | null | undefined>;

/** `{ name: { en, ru, am }, description: { … } }` — shape of an entity's `i18n` column. */
export type I18nMap = Record<string, I18nBag | undefined>;

/**
 * Per-field translation state, so the UI can say "translating…" instead of
 * silently presenting a stale value as final.
 *
 * `stale` and `failed` still carry a displayable value — an out-of-date label
 * beats a blank one — so they are badge-worthy, not blocking.
 */
export type TranslationStatus =
  | "pending"
  | "ready"
  | "stale"
  | "failed"
  | "needs_review"
  | "skipped";

/** Mixin every auto-translated entity carries. All optional: older backend builds omit them. */
export interface Translated {
  i18n?: I18nMap | null;
  /** Language the staff member actually typed in. */
  source_locale?: Lang | null;
  i18n_status?: Record<string, TranslationStatus> | undefined;
}

/**
 * Degradation order when the requested locale is empty.
 *
 * Kept identical to the backend's `translations.fallback` and to the mobile
 * app's resolver: a value must never render populated in one client and blank
 * in another.
 */
export const FALLBACK_ORDER: readonly Lang[] = ["en", "ru", "am"] as const;

const isFilled = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.trim() !== "";

/**
 * Resolve one bag: requested locale → en → ru → am → undefined.
 *
 * This is the single implementation of the fallback rule in the panel. The
 * legacy `name_en/name_ru/name_am` resolvers delegate here so that migrating an
 * entity to the `i18n` bag can never change what the user sees.
 */
export const pickLocale = (bag: I18nBag | null | undefined, lang: Lang): string | undefined => {
  if (!bag) return undefined;

  if (isFilled(bag[lang])) return bag[lang] as string;

  for (const candidate of FALLBACK_ORDER) {
    if (isFilled(bag[candidate])) return bag[candidate] as string;
  }

  return undefined;
};

/**
 * Display value of `field` on an auto-translated entity.
 *
 * Falls back to the raw column last, which is what guarantees a non-empty label
 * for a row created a second ago — before the translation worker has run, and
 * on any backend build that predates the pipeline.
 */
export const tr = <T extends Translated>(
  entity: T | null | undefined,
  field: keyof T & string,
  lang: Lang,
): string => {
  if (!entity) return "";

  const translated = pickLocale(entity.i18n?.[field], lang);
  if (isFilled(translated)) return translated;

  const raw = entity[field];
  return typeof raw === "string" ? raw : "";
};

/** Translation state of a field, for the status badge. `undefined` = backend doesn't report it. */
export const trStatus = <T extends Translated>(
  entity: T | null | undefined,
  field: keyof T & string,
): TranslationStatus | undefined => entity?.i18n_status?.[field];

/**
 * Does this field still need attention from a human?
 *
 * Deliberately narrow: only `failed` (the machine gave up) and `needs_review`
 * (someone edited this locale by hand and the source has since changed) qualify.
 * `stale` is in-flight and resolves itself, so badging it would train staff to
 * ignore the indicator.
 */
export const needsAttention = (status: TranslationStatus | undefined): boolean =>
  status === "failed" || status === "needs_review";
