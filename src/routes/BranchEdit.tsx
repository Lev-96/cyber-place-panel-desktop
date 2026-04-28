import BranchForm from "@/components/branches/BranchForm";
import BranchOpenDaysForm from "@/components/branches/BranchOpenDaysForm";
import BranchPricingForm from "@/components/branches/BranchPricingForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { branchRepository } from "@/repositories/BranchRepository";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const BranchEdit = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(() => branchRepository.byId(id), [id]);
  const [edit, setEdit] = useState(false);
  const [pricing, setPricing] = useState(false);
  const [hours, setHours] = useState(false);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">Invalid branch id.</div>;
  if (loading) return <Spinner />;
  if (error) return <div className="error">{error.message}</div>;
  if (!data) return null;

  const remove = async () => {
    if (!confirm("Delete this branch and all related data?")) return;
    await branchRepository.remove(id);
    nav("/branches");
  };

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={`Branch · ${data.address}`}>
      <div className="gradient-card"><div className="gradient-card-inner">
        <Row k="Address" v={data.address} />
        <Row k="City" v={data.city} />
        <Row k="Country" v={data.country} />
        <Row k="Phone" v={Array.isArray(data.phone) ? data.phone.join(", ") : (data.phone ?? "—")} />
        <Row k="Places" v={String(data.places_count ?? 0)} />
        <Row k="Services" v={String(data.service_count ?? 0)} />
        <Row k="Rating" v={data.ratings_avg_rating != null ? Number(data.ratings_avg_rating).toFixed(1) : "—"} />
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <Button variant="secondary" onClick={() => setEdit(true)}>Edit info</Button>
          <Button variant="secondary" onClick={() => setPricing(true)}>Pricing</Button>
          <Button variant="secondary" onClick={() => setHours(true)}>Working hours</Button>
          <Button variant="secondary" onClick={remove} style={{ color: "#ef4444", borderColor: "#4a1a1a" }}>Delete</Button>
        </div>
      </div></div>

      {edit && <BranchForm initial={data} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); void reload(); }} />}
      {pricing && <BranchPricingForm branch={data} onClose={() => setPricing(false)} onSaved={() => { setPricing(false); void reload(); }} />}
      {hours && <BranchOpenDaysForm branch={data as any} onClose={() => setHours(false)} onSaved={() => { setHours(false); void reload(); }} />}
    </ScreenWithBg>
  );
};

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="kv-row"><span className="k">{k}</span><span className="v">{v}</span></div>
);

export default BranchEdit;
