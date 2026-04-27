import BranchLiveScreen from "@/components/live/BranchLiveScreen";
import { useParams } from "react-router-dom";

const BranchLive = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;
  return <BranchLiveScreen branchId={id} />;
};

export default BranchLive;
