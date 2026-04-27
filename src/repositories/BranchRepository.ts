import { apiGetBranchById, apiGetBranches, GetBranchesParams } from "@/api/branches";
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
}

export const branchRepository = new BranchRepository();
