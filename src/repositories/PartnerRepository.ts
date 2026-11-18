import {
  apiArchivePartner, apiCreatePartner, apiListPartners, apiPartnerSettlement, apiUpdatePartner,
  IPartner, ISettlement, PartnerBody,
} from "@/api/partners";
import { friendlyMutation } from "@/api/fallback";
import { withToast } from "@/ui/notify";

/**
 * «Мои партнёры» (2026-11-18). Reads surface their error (a screen says it
 * could not load, never "no partners"); writes raise the usual toast and
 * rethrow, so the dialog keeps the server's sentence under its fields.
 */
export class PartnerRepository {
  async list(companyId: number, includeArchived = false): Promise<IPartner[]> {
    return (await apiListPartners(companyId, includeArchived)).data;
  }
  async create(companyId: number, body: PartnerBody): Promise<IPartner> {
    return withToast("partner", "created", () => friendlyMutation(apiCreatePartner(companyId, body).then((r) => r.data)));
  }
  async update(id: number, body: PartnerBody): Promise<IPartner> {
    return withToast("partner", "updated", () => friendlyMutation(apiUpdatePartner(id, body).then((r) => r.data)));
  }
  async archive(id: number): Promise<IPartner> {
    return withToast("partner", "archived", () => friendlyMutation(apiArchivePartner(id).then((r) => r.data)));
  }
  async settlement(companyId: number, month: string, branchId: number | null): Promise<ISettlement> {
    return (await apiPartnerSettlement(companyId, { month, ...(branchId !== null ? { branch_id: branchId } : {}) })).data;
  }
}

export const partnerRepository = new PartnerRepository();
