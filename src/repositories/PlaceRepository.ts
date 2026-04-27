import { apiGetPlaces } from "@/api/places";
import { Place } from "@/domain/Place";

export class PlaceRepository {
  async listByBranch(branchId: number): Promise<Place[]> {
    const res = await apiGetPlaces({ branch_id: branchId, per_page: 200 });
    return res.data.map((p) => new Place(p));
  }
}

export const placeRepository = new PlaceRepository();
