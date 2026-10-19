import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { BranchPlatformOption, branchPlatformOptions, platformDisplayNameOf } from "@/i18n/platformPriceName";
import { placeRepository } from "@/repositories/PlaceRepository";
import { platformPriceRepository } from "@/repositories/PlatformPriceRepository";
import type { IBranchPlace, IBranchPlatformPrice } from "@/types/api";
import { useCallback, useMemo } from "react";

const NO_PRICES: Promise<IBranchPlatformPrice[]> = Promise.resolve([]);
const NO_PLACES: Promise<IBranchPlace[]> = Promise.resolve([]);

export interface BranchPlatformNames {
  /** Any slug's display name: PC/PS4/PS5, a custom one from its price row, else de-slugged. */
  nameOf: (slug: string) => string;
  /** The branch's platform price rows; null until the first read lands. */
  prices: readonly IBranchPlatformPrice[] | null;
  /** The read is in flight (first load or a revalidation). */
  loading: boolean;
}

/**
 * The branch's custom-platform NAMES, for screens that only label platforms
 * (sessions board, live floor, games list). One read of
 * `GET /branch-platform-prices?branch_id=…`, served by the HTTP cache (60 s) and
 * re-run by `useAsync` when a write changes it, so a screen and the dialogs it
 * opens share one request instead of each asking again — pass `nameOf` down.
 *
 * Best effort by design: until the read lands, or when it fails, every slug is
 * still named (`platformLabel`), so a label never blanks and the screen never
 * shows an error for a cosmetic read.
 */
export const useBranchPlatformNames = (branchId: number | undefined): BranchPlatformNames => {
  const { lang } = useLang();
  const prices = useAsync(
    () => (branchId !== undefined ? platformPriceRepository.listByBranch(branchId) : NO_PRICES),
    [branchId],
  );
  const rows = prices.data;
  const nameOf = useCallback((slug: string) => platformDisplayNameOf(slug, rows ?? undefined, lang), [rows, lang]);
  return { nameOf, prices: rows, loading: prices.loading };
};

export interface BranchPlatforms extends BranchPlatformNames {
  /** {@link branchPlatformOptions} over the branch's places + price rows (+ `extra`). */
  options: BranchPlatformOption[];
}

/**
 * Every platform THIS branch has, as picker options, for a caller that does
 * not already hold the branch's places and price rows. BranchPlaces and
 * BranchPricesPage already read both and call `branchPlatformOptions`
 * directly — do not stack this hook on top of them.
 *
 * `extra` is the saved slug of the record being edited (see
 * `branchPlatformOptions`).
 */
export const useBranchPlatforms = (branchId: number | undefined, extra?: string | null): BranchPlatforms => {
  const { lang } = useLang();
  const names = useBranchPlatformNames(branchId);
  const places = useAsync(
    () => (branchId !== undefined ? placeRepository.listRawByBranch(branchId) : NO_PLACES),
    [branchId],
  );
  const placeRows = places.data;
  const options = useMemo(
    () => branchPlatformOptions((placeRows ?? []).map((p) => p.platform), names.prices ?? undefined, lang, extra),
    [placeRows, names.prices, lang, extra],
  );
  // A failed read ends `loading` too (useAsync), so a caller never waits forever;
  // the known three plus whatever did load are listed meanwhile.
  return { ...names, options, loading: names.loading || places.loading };
};
