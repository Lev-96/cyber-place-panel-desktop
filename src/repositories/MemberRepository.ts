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
import { friendlyMutation, orFallback } from "@/api/fallback";

export class MemberRepository {
  list(branchId: number, search?: string) { return orFallback(apiListMembers(branchId, search).then((r) => r.data), []); }
  byId(id: number) { return apiGetMember(id).then((r) => r.member); }
  create(b: CreateMemberBody) { return friendlyMutation(apiCreateMember(b).then((r) => r.member)); }
  update(id: number, b: UpdateMemberBody) { return friendlyMutation(apiUpdateMember(id, b).then((r) => r.member)); }
  remove(id: number) { return friendlyMutation(apiDeleteMember(id).then(() => undefined)); }
  topup(id: number, amount: number, ref?: string) { return friendlyMutation(apiTopupMember(id, amount, ref)); }
  adjust(id: number, amount: number, ref?: string) { return friendlyMutation(apiAdjustMember(id, amount, ref)); }
  deposits(id: number) { return orFallback(apiMemberDeposits(id).then((r) => r.data), []); }
}

export const memberRepository = new MemberRepository();
