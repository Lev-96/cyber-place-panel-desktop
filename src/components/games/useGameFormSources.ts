import type { IGameApi } from "@/api/games";
import type { PlatformOption } from "@/components/ui/PlatformPicker";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { customPlatformOptions } from "@/i18n/platformPriceName";
import { gameRepository } from "@/repositories/GameRepository";
import { platformPriceRepository } from "@/repositories/PlatformPriceRepository";
import { useMemo } from "react";

interface Args {
  /** Create mode: editing a game suggests nothing and loads nothing. */
  creating: boolean;
  /** The platform picker is on screen (create, platform not locked). */
  pickerShown: boolean;
  branchId?: number;
  /**
   * The GLOBAL catalogue when the caller already holds it (admin GamesList,
   * PlaceForm). `undefined` = the form loads it itself; `null` = the caller
   * is still loading it (or failed): no second request, no suggestions yet.
   */
  globalCatalogue?: readonly IGameApi[] | null;
  /** THIS branch's games (BranchGames): marks "already in this branch". */
  branchGames?: readonly IGameApi[];
}

export interface GameFormSources {
  /** Every game a new name could duplicate; null while unknown. */
  catalogue: readonly IGameApi[] | null;
  /** Ids of the games already in the branch, or null when the caller has no branch list. */
  inBranch: ReadonlySet<number> | null;
  /** Custom platforms offered as quick buttons next to PC / PS4 / PS5. */
  customPlatforms: PlatformOption[];
}

const NONE = Promise.resolve(null);

/**
 * Where GameForm's suggestions and quick platform buttons come from.
 *
 * Both reads are best-effort: a failure leaves the list empty and the form
 * works exactly as before (Save's 422 `game_exists` is still the authority).
 * Nothing is requested per keystroke: the global catalogue is read once per
 * opened create form, and only when the caller does not already have it.
 *
 * Custom platforms are scoped like the data they come from: with a branch,
 * the branch's own platform prices plus its games; without one (admin), the
 * custom platforms present in the global catalogue. Another company's custom
 * platform must never appear as a button on an owner's form.
 */
export const useGameFormSources = ({ creating, pickerShown, branchId, globalCatalogue, branchGames }: Args): GameFormSources => {
  const { lang } = useLang();
  const selfLoad = creating && globalCatalogue === undefined;
  const loaded = useAsync<readonly IGameApi[] | null>(() => (selfLoad ? gameRepository.list() : NONE), [selfLoad]);
  const pricesFor = pickerShown ? branchId : undefined;
  const prices = useAsync(
    () => (pricesFor !== undefined ? platformPriceRepository.listByBranch(pricesFor) : Promise.resolve([])),
    [pricesFor],
  );

  const own = selfLoad ? loaded.data : globalCatalogue ?? null;
  const catalogue = useMemo(
    () => (own || branchGames ? [...(own ?? []), ...(branchGames ?? [])] : null),
    [own, branchGames],
  );
  const inBranch = useMemo(() => (branchGames ? new Set(branchGames.map((g) => g.id)) : null), [branchGames]);

  const priceRows = prices.data;
  const customPlatforms = useMemo(() => {
    if (!pickerShown) return [];
    const slugs = branchId !== undefined
      ? [...(priceRows ?? []).map((p) => p.platform), ...(branchGames ?? []).map((g) => g.platform)]
      : (own ?? []).map((g) => g.platform);
    return customPlatformOptions(slugs, priceRows ?? undefined, lang);
  }, [pickerShown, branchId, priceRows, branchGames, own, lang]);

  return { catalogue, inBranch, customPlatforms };
};
