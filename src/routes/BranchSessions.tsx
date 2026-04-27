import SessionsBoard from "@/components/sessions/SessionsBoard";
import { useParams } from "react-router-dom";

const BranchSessions = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;
  return <SessionsBoard branchId={id} />;
};

export default BranchSessions;
