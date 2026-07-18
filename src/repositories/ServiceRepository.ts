import { apiCreateService, apiDeleteService, apiGetServices, apiUpdateService, CreateServiceBody } from "@/api/services";
import { withToast } from "@/ui/notify";

const ALL = 500;
import { Service } from "@/domain/Service";
import { IBranchService } from "@/types/api";

export class ServiceRepository {
  async listByBranch(branchId: number): Promise<Service[]> {
    const res = await apiGetServices({ branch_id: branchId, per_page: ALL });
    return res.data.map((s) => new Service(s));
  }
  async listAll(): Promise<IBranchService[]> {
    return (await apiGetServices({ per_page: ALL })).data;
  }
  async create(b: CreateServiceBody) { return withToast("service", "created", async () => { const r = await apiCreateService(b); return r.service ?? r.data; }); }
  async update(id: number, b: CreateServiceBody) { return withToast("service", "updated", async () => { const r = await apiUpdateService(id, b); return r.service ?? r.data; }); }
  async remove(id: number) { await withToast("service", "deleted", () => apiDeleteService(id)); }
}

export const serviceRepository = new ServiceRepository();
