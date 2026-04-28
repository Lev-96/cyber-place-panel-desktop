import {
  apiCreatePlace, apiDeletePlace, apiGetPlaceById, apiGetPlaces, apiNextPlaceNumber, apiUpdatePlace,
  CreatePlaceBody, UpdatePlaceBody,
} from "@/api/places";
import { Place } from "@/domain/Place";
import { IBranchPlace } from "@/types/api";

export class PlaceRepository {
  async listByBranch(branchId: number): Promise<Place[]> {
    const res = await apiGetPlaces({ branch_id: branchId, per_page: 200 });
    return res.data.map((p) => new Place(p));
  }
  async listRawByBranch(branchId: number): Promise<IBranchPlace[]> {
    return (await apiGetPlaces({ branch_id: branchId, per_page: 200 })).data;
  }
  async byId(id: number): Promise<IBranchPlace> {
    return (await apiGetPlaceById(id)).data;
  }
  async create(b: CreatePlaceBody): Promise<void> { await apiCreatePlace(b); }
  async update(id: number, b: UpdatePlaceBody): Promise<void> { await apiUpdatePlace(id, b); }
  async remove(id: number): Promise<void> { await apiDeletePlace(id); }
  nextNumber(branchId: number) { return apiNextPlaceNumber(branchId).then((r) => r.next); }
}

export const placeRepository = new PlaceRepository();
