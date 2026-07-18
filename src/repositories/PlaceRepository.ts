import {
  apiCreatePlace, apiDeletePlace, apiGetPlaceById, apiGetPlaces, apiNextPlaceNumber, apiUpdatePlace,
  CreatePlaceBody, UpdatePlaceBody,
} from "@/api/places";
import { Place } from "@/domain/Place";
import { IBranchPlace } from "@/types/api";
import { withToast } from "@/ui/notify";

// "Load all" cap for un-paginated lists: one request large enough to cover a
// venue's full inventory. The backend honours per_page, so this returns every
// row in a single call (no page-looping → no duplicates).
const ALL = 500;

export class PlaceRepository {
  async listByBranch(branchId: number): Promise<Place[]> {
    const res = await apiGetPlaces({ branch_id: branchId, per_page: ALL });
    return res.data.map((p) => new Place(p));
  }
  async listRawByBranch(branchId: number): Promise<IBranchPlace[]> {
    return (await apiGetPlaces({ branch_id: branchId, per_page: ALL })).data;
  }
  async byId(id: number): Promise<IBranchPlace> {
    return (await apiGetPlaceById(id)).data;
  }
  async create(b: CreatePlaceBody): Promise<void> { await withToast("place", "created", () => apiCreatePlace(b)); }
  async update(id: number, b: UpdatePlaceBody): Promise<void> { await withToast("place", "updated", () => apiUpdatePlace(id, b)); }
  async remove(id: number): Promise<void> { await withToast("place", "deleted", () => apiDeletePlace(id)); }
  nextNumber(branchId: number) { return apiNextPlaceNumber(branchId).then((r) => r.next); }
}

export const placeRepository = new PlaceRepository();
