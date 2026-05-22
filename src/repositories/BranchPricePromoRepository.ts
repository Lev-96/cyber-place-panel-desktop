import {
  apiCreatePromo,
  apiDeletePromo,
  apiListPromosForBranch,
  apiUpdatePromo,
  CreatePromoBody,
  UpdatePromoBody,
} from "@/api/branchPricePromos";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { IBranchPricePromo } from "@/types/promos";

/**
 * Same lifecycle wrapper TimePackageRepository uses: GETs fall back to
 * `[]` when the endpoint hasn't shipped yet (lets the UI render a
 * stable empty state on stage instead of throwing), mutations get a
 * friendly "not deployed yet" message rewritten by friendlyMutation.
 */
export class BranchPricePromoRepository {
  async listByBranch(branchId: number): Promise<IBranchPricePromo[]> {
    return orFallback(
      apiListPromosForBranch(branchId).then((r) => r.data),
      [],
    );
  }
  async create(body: CreatePromoBody): Promise<IBranchPricePromo> {
    return friendlyMutation(apiCreatePromo(body).then((r) => r.promo));
  }
  async update(id: number, body: UpdatePromoBody): Promise<IBranchPricePromo> {
    return friendlyMutation(apiUpdatePromo(id, body).then((r) => r.promo));
  }
  async remove(id: number): Promise<void> {
    await friendlyMutation(apiDeletePromo(id));
  }
}

export const branchPricePromoRepository = new BranchPricePromoRepository();
