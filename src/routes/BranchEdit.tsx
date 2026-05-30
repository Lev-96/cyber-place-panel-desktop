import BranchForm from "@/components/branches/BranchForm";
import BranchOpenDaysForm from "@/components/branches/BranchOpenDaysForm";
import BranchUnlockPinCard from "@/components/branches/BranchUnlockPinCard";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { branchRepository } from "@/repositories/BranchRepository";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Pricing has its own dedicated page — see /branches/:id/tariffs
// (BranchPricesPage). Keeping it here would duplicate the source of
// truth and confuse who owns the matrix.
const BranchEdit = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const nav = useNavigate();
  const { t } = useLang();
  const { data, loading, error, reload } = useAsync(() => branchRepository.byId(id), [id]);
  const [edit, setEdit] = useState(false);
  const [hours, setHours] = useState(false);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("error.invalidBranchId")}</div>;
  if (loading) return <Spinner />;
  if (error) return <div className="error">{error.message}</div>;
  if (!data) return null;

  const remove = async () => {
    if (!confirm(t("branchEdit.confirmDelete"))) return;
    await branchRepository.remove(id);
    nav("/branches");
  };

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={fmt(t("branchEdit.title"), data.address)}>
      <div className="gradient-card"><div className="gradient-card-inner">
        <Row k={t("branch.address")} v={data.address} />
        <Row k={t("branch.city")} v={data.city} />
        <Row k={t("branch.country")} v={data.country} />
        <Row k={t("label.phone")} v={Array.isArray(data.phone) ? data.phone.join(", ") : (data.phone ?? "—")} />
        <Row k={t("label.places")} v={String(data.places_count ?? 0)} />
        <Row k={t("branch.editTabs.services")} v={String(data.service_count ?? 0)} />
        <Row k={t("branch.rating")} v={data.ratings_avg_rating != null ? Number(data.ratings_avg_rating).toFixed(1) : "—"} />
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <Button variant="secondary" onClick={() => setEdit(true)}>{t("branchEdit.editInfo")}</Button>
          <Button variant="secondary" onClick={() => setHours(true)}>{t("branch.editTabs.hours")}</Button>
          <Button variant="secondary" onClick={remove} style={{ color: "#ef4444", borderColor: "#4a1a1a" }}>{t("action.delete")}</Button>
        </div>
      </div></div>

      <BranchUnlockPinCard
        branchId={id}
        updatedAt={data.unlock_pin_updated_at ?? null}
        onSaved={() => void reload()}
      />

      {edit && <BranchForm initial={data} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); void reload(); }} />}
      {hours && <BranchOpenDaysForm branch={data} onClose={() => setHours(false)} onSaved={() => { setHours(false); void reload(); }} />}
    </ScreenWithBg>
  );
};

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="kv-row"><span className="k">{k}</span><span className="v">{v}</span></div>
);

export default BranchEdit;
