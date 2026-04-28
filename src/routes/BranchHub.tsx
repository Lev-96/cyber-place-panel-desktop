import BranchLiveScreen from "@/components/live/BranchLiveScreen";
import Avatar from "@/components/ui/Avatar";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { branchRepository } from "@/repositories/BranchRepository";
import { Link, useParams } from "react-router-dom";

const BranchHub = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { data, loading, error } = useAsync(() => branchRepository.byId(id), [id]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={data ? `${data.company?.name ?? "Branch"} · ${data.address}` : `Branch #${id}`}>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}

      {data && (
        <div className="row" style={{ gap: 16, alignItems: "center" }}>
          <Avatar src={data.branch_logo_path} name={data.address} size={72} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.address}</div>
            <div className="muted">{data.company?.name ?? ""} · {data.country}, {data.city}</div>
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <Tile to={`/branches/${id}/sessions`} title="Sessions" hint="Start / stop · billing" />
        <Tile to={`/branches/${id}/pos`} title="POS" hint="Sell drinks &amp; snacks" />
        <Tile to={`/branches/${id}/shift`} title="Shift" hint="Open / close · Z-report" />
        <Tile to={`/branches/${id}/members`} title="Members" hint="Cards &amp; deposits" />
        <Tile to={`/branches/${id}/places`} title="Places" hint="Bookable seats · games" />
        <Tile to={`/branches/${id}/pcs`} title="PCs" hint="Agent registration" />
        <Tile to={`/branches/${id}/tariffs`} title="Tariffs" hint="Time packages" />
        <Tile to={`/branches/${id}/products`} title="Products" hint="POS catalog" />
        <Tile to={`/branches/${id}/services`} title="Services" hint="What this branch offers" />
        <Tile to={`/branches/${id}/managers`} title="Managers" hint="Branch staff" />
        <Tile to={`/branches/${id}/tournaments`} title="Tournaments" hint="Events" />
        <Tile to={`/branches/${id}/edit`} title="Settings" hint="Address · pricing · hours" />
      </div>

      <div style={{ marginTop: 8 }}>
        <BranchLiveScreen branchId={id} />
      </div>
    </ScreenWithBg>
  );
};

const Tile = ({ to, title, hint }: { to: string; title: string; hint: string }) => (
  <Link to={to} className="card" style={{ flex: "1 1 200px", minWidth: 200, textDecoration: "none" }}>
    <div style={{ fontWeight: 700, fontSize: 16, color: "#07ddf1" }}>{title}</div>
    <div className="muted" style={{ fontSize: 12 }}>{hint}</div>
  </Link>
);

export default BranchHub;
