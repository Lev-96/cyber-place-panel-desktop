import { apiCreateService, apiDeleteService, apiGetServices, apiUpdateService, CreateServiceBody } from "@/api/services";
import { Service } from "@/domain/Service";
import { IBranchService } from "@/types/api";

export class ServiceRepository {
  async listByBranch(branchId: number): Promise<Service[]> {
    const res = await apiGetServices({ branch_id: branchId, per_page: 200 });
    return res.data.map((s) => new Service(s));
  }
  async listAll(): Promise<IBranchService[]> {
    const res = await apiGetServices({ per_page: 500 });
    return res.data;
  }
  async create(b: CreateServiceBody) { const r = await apiCreateService(b); return r.service ?? r.data; }
  async update(id: number, b: CreateServiceBody) { const r = await apiUpdateService(id, b); return r.service ?? r.data; }
  async remove(id: number) { await apiDeleteService(id); }
}

export const serviceRepository = new ServiceRepository();
