import { apiListProductEvents, apiProductEventActors } from "@/api/productEvents";
import { isMissingEndpoint } from "@/api/fallback";
import type { IProductEventActorOption, ProductEventFilters } from "@/types/productEvents";

/**
 * The product audit trail. Reads are NOT wrapped in a fallback: an audit that
 * silently reads as empty when the request failed says "nobody changed
 * anything" — the screen shows the error instead.
 *
 * The one exception is {@link available}: a backend from before the trail
 * answers 404, and the panel then simply has no history to offer.
 */
export class ProductEventRepository {
  list(filters: ProductEventFilters) {
    return apiListProductEvents(filters);
  }

  actors(branchId?: number): Promise<IProductEventActorOption[]> {
    return apiProductEventActors(branchId).then((r) => (Array.isArray(r) ? r : r.data ?? []));
  }

  /**
   * Whether this backend has the trail. Only 404 / 501 mean "not deployed";
   * any other failure (offline, 500, 403 on a narrowed account) keeps the
   * entry visible, and the history itself then shows that error.
   */
  async available(branchId: number): Promise<boolean> {
    try {
      await apiProductEventActors(branchId);
      return true;
    } catch (e) {
      if (isMissingEndpoint(e)) return false;
      return true;
    }
  }
}

export const productEventRepository = new ProductEventRepository();
