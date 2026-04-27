import Spinner from "@/components/ui/Spinner";
import { useRealtimeBranch } from "@/hooks/useRealtimeBranch";
import Button from "@/components/ui/Button";
import PlaceCell from "./PlaceCell";
import ServicesRow from "./ServicesRow";
import StatusLegend from "./StatusLegend";

const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const BranchLiveScreen = ({ branchId }: { branchId: number }) => {
  const { snapshot, error, loading, refresh } = useRealtimeBranch(branchId);

  if (loading && !snapshot) return <Spinner />;
  if (error && !snapshot) return <div className="error">Failed to load live data</div>;
  if (!snapshot) return null;

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>Live · branch #{branchId}</h2>
        <div className="row" style={{ gap: 12 }}>
          <span className="muted">updated {fmt(snapshot.takenAt)}</span>
          <Button variant="secondary" onClick={refresh}>Refresh</Button>
        </div>
      </div>
      <StatusLegend totals={snapshot.totals} />
      <div className="live-grid">
        {snapshot.places.map((s) => <PlaceCell key={s.place.id} snapshot={s} />)}
      </div>
      <ServicesRow services={snapshot.services} />
    </div>
  );
};

export default BranchLiveScreen;
