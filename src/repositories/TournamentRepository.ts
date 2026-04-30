import {
  apiCreateTournament,
  apiDeleteTournament,
  apiGetTournament,
  apiListTournaments,
  apiUpdateTournament,
  CreateTournamentBody,
  UpdateTournamentBody,
} from "@/api/tournaments";

export class TournamentRepository {
  list(branchId?: number) {
    return apiListTournaments(branchId ? { branch_id: branchId } : {}).then(
      (r) => r.data,
    );
  }
  byId(id: number) {
    return apiGetTournament(id).then((r) => r.tournament);
  }
  create(b: CreateTournamentBody) {
    return apiCreateTournament(b).then((r) => r.tournament);
  }
  update(id: number, b: UpdateTournamentBody) {
    return apiUpdateTournament(id, b).then((r) => r.tournament);
  }
  remove(id: number) {
    return apiDeleteTournament(id).then(() => undefined);
  }
}

export const tournamentRepository = new TournamentRepository();
