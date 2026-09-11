import {
  apiDeleteOwner, apiGetOwner, apiListOwners, apiUpdateOwner,
  IOwnerApi, IOwnerDeletionResultApi, IOwnerDetailApi, UpdateOwnerBody,
} from "@/api/owners";
import { PaginatedList } from "@/types/api";
import { withToast } from "@/ui/notify";

/** One screen of owners — dense rows, and the server caps a page at 100. */
export const OWNERS_PER_PAGE = 20;

/**
 * The admin's Owners section. Follows `ManagerRepository` (toasts on writes)
 * with two deliberate differences:
 *
 *  - No `orFallback` on reads: an empty list is what that turns a failure
 *    into, and "no owners" on a screen that lists every partner on the
 *    platform is a false statement, not a graceful degradation.
 *  - No `friendlyMutation` on writes: it rewrites a 404 into "endpoint not
 *    deployed", and here a 404 means the owner is already gone (another admin
 *    deleted them) — the server's own sentence says so.
 */
export class OwnerRepository {
  /** One page, filtered server-side by name / email / company name. */
  async listPaged(page: number, search: string): Promise<PaginatedList<IOwnerApi>> {
    return apiListOwners({ page, search: search || undefined, per_page: OWNERS_PER_PAGE });
  }

  /** The owner with the deletion preview the confirmation is built from. */
  async byId(id: number): Promise<IOwnerDetailApi> {
    return (await apiGetOwner(id)).data;
  }

  async update(id: number, body: UpdateOwnerBody): Promise<IOwnerApi> {
    return withToast("owner", "updated", async () => (await apiUpdateOwner(id, body)).data);
  }

  async remove(id: number): Promise<IOwnerDeletionResultApi> {
    return withToast("owner", "deleted", async () => (await apiDeleteOwner(id)).data);
  }
}

export const ownerRepository = new OwnerRepository();
