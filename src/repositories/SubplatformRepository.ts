import {
  CreateSubplatformBody,
  UpdateSubplatformBody,
  apiCreateSubplatform,
  apiDeleteSubplatform,
  apiListSubplatforms,
  apiUpdateSubplatform,
} from "@/api/subplatforms";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { IBranchSubplatform } from "@/types/api";

/**
 * Subplatforms. Reads fall back to an empty list when the endpoint isn't
 * deployed yet, exactly like platform prices — a panel running against an older
 * backend then shows no subplatform tabs at all and every place is created the
 * way it always was, instead of the place form failing to open.
 */
export class SubplatformRepository {
  /** One platform's subplatforms (default first, then most-used). */
  async listByPlatform(branchId: number, platform: string): Promise<IBranchSubplatform[]> {
    return orFallback(apiListSubplatforms(branchId, platform).then((r) => r.data), []);
  }

  /** Every subplatform of the branch — what Branch Prices lists. */
  async listByBranch(branchId: number): Promise<IBranchSubplatform[]> {
    return orFallback(apiListSubplatforms(branchId).then((r) => r.data), []);
  }

  async create(body: CreateSubplatformBody): Promise<IBranchSubplatform> {
    return friendlyMutation(apiCreateSubplatform(body).then((r) => r.data));
  }

  async update(id: number, body: UpdateSubplatformBody): Promise<IBranchSubplatform> {
    return friendlyMutation(apiUpdateSubplatform(id, body).then((r) => r.data));
  }

  async remove(id: number): Promise<void> {
    return friendlyMutation(apiDeleteSubplatform(id));
  }
}

export const subplatformRepository = new SubplatformRepository();
