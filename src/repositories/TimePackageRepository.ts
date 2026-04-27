import {
  apiCreatePackage,
  apiDeletePackage,
  apiListPackagesForBranch,
  apiUpdatePackage,
  CreateTimePackageBody,
  UpdateTimePackageBody,
} from "@/api/timePackages";
import { ITimePackage } from "@/types/sessions";

export class TimePackageRepository {
  async listByBranch(branchId: number): Promise<ITimePackage[]> {
    return (await apiListPackagesForBranch(branchId)).data;
  }
  async create(body: CreateTimePackageBody): Promise<ITimePackage> {
    return (await apiCreatePackage(body)).package;
  }
  async update(id: number, body: UpdateTimePackageBody): Promise<ITimePackage> {
    return (await apiUpdatePackage(id, body)).package;
  }
  async remove(id: number): Promise<void> {
    await apiDeletePackage(id);
  }
}

export const timePackageRepository = new TimePackageRepository();
