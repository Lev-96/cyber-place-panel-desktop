import { apiGetServices } from "@/api/services";
import { Service } from "@/domain/Service";

export class ServiceRepository {
  async listByBranch(branchId: number): Promise<Service[]> {
    const res = await apiGetServices({ branch_id: branchId, per_page: 200 });
    return res.data.map((s) => new Service(s));
  }
}

export const serviceRepository = new ServiceRepository();
