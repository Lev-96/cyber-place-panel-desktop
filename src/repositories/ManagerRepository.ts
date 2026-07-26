import {
  apiCreateManager, apiDeleteManager, apiGetManager, apiListManagers, apiUpdateManager,
  CreateManagerBody, IManagerApi, UpdateManagerBody,
} from "@/api/managers";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { withToast } from "@/ui/notify";

const ALL = 500;

export class ManagerRepository {
  async listByBranch(branchId: number): Promise<IManagerApi[]> {
    return orFallback(apiListManagers({ branch_id: branchId, per_page: ALL }).then((r) => r.data), []);
  }
  async list(): Promise<IManagerApi[]> {
    return orFallback(apiListManagers({ per_page: ALL }).then((r) => r.data), []);
  }
  async byId(id: number): Promise<IManagerApi> {
    return (await apiGetManager(id)).data;
  }
  async create(b: CreateManagerBody): Promise<IManagerApi | null> {
    return withToast("manager", "created", async () => {
      const r = await friendlyMutation(apiCreateManager(b));
      return r.manager ?? (Array.isArray(r.data) ? r.data[0] : null);
    });
  }
  async update(id: number, b: UpdateManagerBody): Promise<IManagerApi | null> {
    return withToast("manager", "updated", async () => {
      const r = await friendlyMutation(apiUpdateManager(id, b));
      return r.manager ?? null;
    });
  }
  async remove(id: number): Promise<void> {
    await withToast("manager", "deleted", () => friendlyMutation(apiDeleteManager(id)));
  }
}

export const managerRepository = new ManagerRepository();
