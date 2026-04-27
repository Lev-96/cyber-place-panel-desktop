import {
  apiCreatePc,
  apiDeletePc,
  apiListPcsForBranch,
  apiRotatePcToken,
  apiUpdatePc,
  CreatePcBody,
  UpdatePcBody,
} from "@/api/pcs";
import { IPcApi } from "@/types/sessions";

export class PcRepository {
  async listByBranch(branchId: number): Promise<IPcApi[]> {
    return (await apiListPcsForBranch(branchId)).data;
  }
  async create(body: CreatePcBody): Promise<IPcApi> {
    return (await apiCreatePc(body)).pc;
  }
  async update(id: number, body: UpdatePcBody): Promise<IPcApi> {
    return (await apiUpdatePc(id, body)).pc;
  }
  async remove(id: number): Promise<void> {
    await apiDeletePc(id);
  }
  async rotateToken(id: number): Promise<IPcApi> {
    return (await apiRotatePcToken(id)).pc;
  }
}

export const pcRepository = new PcRepository();
