import {
  apiCreateBranch, apiDeleteBranch, apiGetBranchById, apiGetBranches, apiUpdateBranch,
  apiUpdateBranchOpenDays, apiUpdateBranchPricing, apiUpdateBranchServices,
  CreateBranchBody, GetBranchesParams, UpdateBranchBody,
} from "@/api/branches";
import { IBranchApi } from "@/types/api";

export class BranchRepository {
  async list(params: GetBranchesParams = {}): Promise<IBranchApi[]> {
    const res = await apiGetBranches({ per_page: 100, ...params });
    return res.data;
  }
  async byId(id: number): Promise<IBranchApi> {
    const res = await apiGetBranchById(id);
    return res.branch;
  }
  async create(b: CreateBranchBody): Promise<IBranchApi> {
    const r = await apiCreateBranch(b);
    if (r.branch) return r.branch;
    // Backend may return only `{ message }` — fall back to refetch by listing.
    const list = await this.list({ company_id: b.company_id });
    const found = [...list].reverse().find((x) => x.address === b.address);
    if (found) return found;
    throw new Error("Branch saved but could not be re-fetched");
  }
  async update(id: number, b: UpdateBranchBody): Promise<IBranchApi> {
    const r = await apiUpdateBranch(id, b);
    return r.branch ?? (await this.byId(id));
  }
  async remove(id: number): Promise<void> { await apiDeleteBranch(id); }
  updatePricing = apiUpdateBranchPricing;
  updateOpenDays = apiUpdateBranchOpenDays;
  updateServices = apiUpdateBranchServices;
}

export const branchRepository = new BranchRepository();
