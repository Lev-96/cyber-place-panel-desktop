import {
  apiCreatePc,
  apiDeletePc,
  apiListPcsForBranch,
  apiRotatePcToken,
  apiUpdatePc,
  CreatePcBody,
  UpdatePcBody,
} from "@/api/pcs";
import { friendlyMutation, orFallback } from "@/api/fallback";
import { IPcApi } from "@/types/sessions";

export class PcRepository {
  async listByBranch(branchId: number): Promise<IPcApi[]> {
    return orFallback(apiListPcsForBranch(branchId).then((r) => r.data), []);
  }
  async create(body: CreatePcBody): Promise<IPcApi> {
    return friendlyMutation(apiCreatePc(body).then((r) => r.pc));
  }
  async update(id: number, body: UpdatePcBody): Promise<IPcApi> {
    return friendlyMutation(apiUpdatePc(id, body).then((r) => r.pc));
  }
  async remove(id: number): Promise<void> {
    await friendlyMutation(apiDeletePc(id));
  }
  async rotateToken(id: number): Promise<IPcApi> {
    return friendlyMutation(apiRotatePcToken(id).then((r) => r.pc));
  }
}

export const pcRepository = new PcRepository();
