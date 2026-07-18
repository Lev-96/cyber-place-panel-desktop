import {
  apiCreateBranch, apiDeleteBranch, apiGetBranchById, apiGetBranches, apiUpdateBranch,
  apiUpdateBranchOpenDays, apiUpdateBranchPricing, apiUpdateBranchServices,
  CreateBranchBody, GetBranchesParams, UpdateBranchBody,
} from "@/api/branches";
import { IBranchApi, PaginatedList } from "@/types/api";
import { withToast } from "@/ui/notify";

export class BranchRepository {
  async list(params: GetBranchesParams = {}): Promise<IBranchApi[]> {
    const res = await apiGetBranches({ per_page: 100, ...params });
    return res.data;
  }
  /** One page + pagination meta, for the paginated Branches list screen. */
  async listPaged(page: number, params: GetBranchesParams = {}): Promise<PaginatedList<IBranchApi>> {
    return apiGetBranches({ per_page: 12, ...params, page });
  }
  async byId(id: number): Promise<IBranchApi> {
    const res = await apiGetBranchById(id);
    return res.branch;
  }
  async create(b: CreateBranchBody): Promise<IBranchApi> {
    return withToast("branch", "created", async () => {
      const r = await apiCreateBranch(b);
      if (r.branch) return r.branch;
      // Backend may return only `{ message }` — fall back to refetch by listing.
      const list = await this.list({ company_id: b.company_id });
      const found = [...list].reverse().find((x) => x.address === b.address);
      if (found) return found;
      throw new Error("Branch saved but could not be re-fetched");
    });
  }
  async update(id: number, b: UpdateBranchBody): Promise<IBranchApi> {
    return withToast("branch", "updated", async () => {
      const r = await apiUpdateBranch(id, b);
      return r.branch ?? (await this.byId(id));
    });
  }
  async remove(id: number): Promise<void> { await withToast("branch", "deleted", () => apiDeleteBranch(id)); }
  updatePricing = apiUpdateBranchPricing;
  updateOpenDays = apiUpdateBranchOpenDays;
  updateServices = apiUpdateBranchServices;
}

export const branchRepository = new BranchRepository();
