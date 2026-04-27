import {
  apiAdjustMember,
  apiCreateMember,
  apiDeleteMember,
  apiGetMember,
  apiListMembers,
  apiMemberDeposits,
  apiTopupMember,
  apiUpdateMember,
  CreateMemberBody,
  UpdateMemberBody,
} from "@/api/members";

export class MemberRepository {
  list(branchId: number, search?: string) { return apiListMembers(branchId, search).then((r) => r.data); }
  byId(id: number) { return apiGetMember(id).then((r) => r.member); }
  create(b: CreateMemberBody) { return apiCreateMember(b).then((r) => r.member); }
  update(id: number, b: UpdateMemberBody) { return apiUpdateMember(id, b).then((r) => r.member); }
  remove(id: number) { return apiDeleteMember(id).then(() => undefined); }
  topup(id: number, amount: number, ref?: string) { return apiTopupMember(id, amount, ref); }
  adjust(id: number, amount: number, ref?: string) { return apiAdjustMember(id, amount, ref); }
  deposits(id: number) { return apiMemberDeposits(id).then((r) => r.data); }
}

export const memberRepository = new MemberRepository();
