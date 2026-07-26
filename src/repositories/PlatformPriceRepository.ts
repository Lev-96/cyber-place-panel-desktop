import { apiListPlatformPrices, apiUpdatePlatformPrice, UpdatePlatformPriceBody } from "@/api/platformPrices";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { IBranchPlatformPrice } from "@/types/api";

/**
 * Custom-platform prices. Reads fall back to an empty list when the endpoint
 * isn't deployed yet, so the place form degrades gracefully (it just treats
 * every custom platform as new). Prices are created/removed implicitly through
 * the place lifecycle — only editing an existing one is exposed here.
 */
export class PlatformPriceRepository {
  async listByBranch(branchId: number): Promise<IBranchPlatformPrice[]> {
    return orFallback(apiListPlatformPrices(branchId).then((r) => r.data), []);
  }
  async update(id: number, body: UpdatePlatformPriceBody): Promise<IBranchPlatformPrice> {
    return friendlyMutation(apiUpdatePlatformPrice(id, body).then((r) => r.data));
  }
}

export const platformPriceRepository = new PlatformPriceRepository();
