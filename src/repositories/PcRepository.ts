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
import { withToast } from "@/ui/notify";
import { IPcApi } from "@/types/sessions";
import { PC_KIND } from "@/types/pc";

export class PcRepository {
  /**
   * The Computers section's list: agent-backed machines only.
   *
   * A console place owns a device too — it has to, sessions cannot exist
   * without one — but it is not a computer and never belongs on this screen.
   * The sessions board fetches its own, unfiltered list (SessionRepository),
   * so narrowing here cannot hide a console from billing.
   */
  async listByBranch(branchId: number): Promise<IPcApi[]> {
    return orFallback(apiListPcsForBranch(branchId, PC_KIND.Pc).then((r) => r.data), []);
  }
  async create(body: CreatePcBody): Promise<IPcApi> {
    return withToast("pc", "created", () => friendlyMutation(apiCreatePc(body).then((r) => r.pc)));
  }
  async update(id: number, body: UpdatePcBody): Promise<IPcApi> {
    return withToast("pc", "updated", () => friendlyMutation(apiUpdatePc(id, body).then((r) => r.pc)));
  }
  async remove(id: number): Promise<void> {
    await withToast("pc", "deleted", () => friendlyMutation(apiDeletePc(id)));
  }
  async rotateToken(id: number): Promise<IPcApi> {
    return friendlyMutation(apiRotatePcToken(id).then((r) => r.pc));
  }
}

export const pcRepository = new PcRepository();
