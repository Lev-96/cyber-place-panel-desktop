import BranchMap from "@/components/map/BranchMap";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { branchRepository } from "@/repositories/BranchRepository";

/** Laravel returns decimal columns as strings ("40.1800000"). Parse safely. */
const toCoord = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return null; // 0 means "not set" per backend `not_in:0` validator
  return n;
};

const BranchesMap = () => {
  const { data, loading, error } = useAsync(() => branchRepository.list(), []);

  const markers = (data ?? [])
    .map((b) => ({
      lat: toCoord(b.address_lat),
      lng: toCoord(b.address_lng),
      label: `<b>${b.company?.name ?? "Branch"}</b><br>${b.address}<br><a href="#/branches/${b.id}">Open →</a>`,
    }))
    .filter((m): m is { lat: number; lng: number; label: string } => m.lat !== null && m.lng !== null);

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title="Branches map">
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <>
          <span className="muted">{markers.length} of {data?.length ?? 0} branches geo-located</span>
          <BranchMap markers={markers} height={520} />
          {!markers.length && (
            <div className="card col" style={{ gap: 6 }}>
              <strong>No branches geo-located yet.</strong>
              <span className="muted" style={{ fontSize: 13 }}>
                Open a branch → Edit → save with a pin on the map. The map will show all branches with non-zero coordinates.
              </span>
            </div>
          )}
        </>
      )}
    </ScreenWithBg>
  );
};

export default BranchesMap;
