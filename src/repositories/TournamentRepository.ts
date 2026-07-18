import {
  apiCreateTournament,
  apiDeleteTournament,
  apiGetTournament,
  apiListTournaments,
  apiUpdateTournament,
  CreateTournamentBody,
  UpdateTournamentBody,
} from "@/api/tournaments";
import { withToast } from "@/ui/notify";

export class TournamentRepository {
  list(branchId?: number) {
    return apiListTournaments(branchId ? { branch_id: branchId } : {}).then(
      (r) => r.data,
    );
  }
  /** One page + pagination meta, for the paginated Tournaments screen. */
  listPaged(page: number, branchId?: number) {
    return apiListTournaments({ ...(branchId ? { branch_id: branchId } : {}), per_page: 12, page });
  }
  byId(id: number) {
    return apiGetTournament(id).then((r) => r.tournament);
  }
  create(b: CreateTournamentBody) {
    return withToast("tournament", "created", () => apiCreateTournament(b).then((r) => r.tournament));
  }
  update(id: number, b: UpdateTournamentBody) {
    return withToast("tournament", "updated", () => apiUpdateTournament(id, b).then((r) => r.tournament));
  }
  remove(id: number) {
    return withToast("tournament", "deleted", () => apiDeleteTournament(id).then(() => undefined));
  }
}

export const tournamentRepository = new TournamentRepository();
