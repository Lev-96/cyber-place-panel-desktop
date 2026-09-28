import {
  apiCreatePackage,
  apiDeletePackage,
  apiListPackagesForBranch,
  apiUpdatePackage,
  CreateTimePackageBody,
  UpdateTimePackageBody,
} from "@/api/timePackages";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { withToast } from "@/ui/notify";
import { ITimePackage } from "@/types/sessions";

export class TimePackageRepository {
  async listByBranch(branchId: number): Promise<ITimePackage[]> {
    return orFallback(apiListPackagesForBranch(branchId).then((r) => r.data), []);
  }
  async create(body: CreateTimePackageBody): Promise<ITimePackage> {
    return withToast("package", "created", () => friendlyMutation(apiCreatePackage(body).then((r) => r.package)));
  }
  async update(id: number, body: UpdateTimePackageBody): Promise<ITimePackage> {
    return withToast("package", "updated", () => friendlyMutation(apiUpdatePackage(id, body).then((r) => r.package)));
  }
  async remove(id: number): Promise<void> {
    await withToast("package", "deleted", () => friendlyMutation(apiDeletePackage(id)));
  }
}

export const timePackageRepository = new TimePackageRepository();
