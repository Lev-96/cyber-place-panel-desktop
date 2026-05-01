import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import BranchLiveScreen from "@/components/live/BranchLiveScreen";
import Avatar from "@/components/ui/Avatar";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { Link, useParams } from "react-router-dom";

const BranchHub = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const { user } = useAuth();
  const role = user?.role;
  const { data, loading, error } = useAsync(() => branchRepository.byId(id), [id]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={data ? `${data.company?.name ?? t("hub.branchFallback")} · ${data.address}` : `${t("hub.branchFallback")} #${id}`}>
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

      <div
        className="row"
        style={{
          // CSS grid keeps every tile in a perfectly even rhythm — same width,
          // same row height, same gap — regardless of language. `auto-fill`
          // packs as many 220px-wide tiles as fit; `minmax(220px, 1fr)` lets
          // them stretch to fill the row evenly when there's leftover space.
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          width: "100%",
        }}
      >
        <Tile to={`/branches/${id}/sessions`} title={t("hub.tile.sessions")} hint={t("hub.tile.sessionsHint")} />
        <Tile to={`/branches/${id}/pos`} title={t("hub.tile.pos")} hint={t("hub.tile.posHint")} />
        <Tile to={`/branches/${id}/shift`} title={t("hub.tile.shift")} hint={t("hub.tile.shiftHint")} />
        <Tile to={`/branches/${id}/members`} title={t("hub.tile.members")} hint={t("hub.tile.membersHint")} />
        <Tile to={`/branches/${id}/places`} title={t("hub.tile.places")} hint={t("hub.tile.placesHint")} />
        <Tile to={`/branches/${id}/pcs`} title={t("hub.tile.pcs")} hint={t("hub.tile.pcsHint")} />
        {can(role, "branch.tariffs") && (
          <Tile to={`/branches/${id}/tariffs`} title={t("hub.tile.tariffs")} hint={t("hub.tile.tariffsHint")} />
        )}
        <Tile to={`/branches/${id}/products`} title={t("hub.tile.products")} hint={t("hub.tile.productsHint")} />
        <Tile to={`/branches/${id}/services`} title={t("hub.tile.services")} hint={t("hub.tile.servicesHint")} />
        {can(role, "manager.create") && (
          <Tile to={`/branches/${id}/managers`} title={t("hub.tile.managers")} hint={t("hub.tile.managersHint")} />
        )}
        <Tile to={`/branches/${id}/tournaments`} title={t("hub.tile.tournaments")} hint={t("hub.tile.tournamentsHint")} />
        <Tile to={`/branches/${id}/edit`} title={t("hub.tile.settings")} hint={t("hub.tile.settingsHint")} />
      </div>

      <div style={{ marginTop: 8 }}>
        <BranchLiveScreen branchId={id} />
      </div>
    </ScreenWithBg>
  );
};

const Tile = ({ to, title, hint }: { to: string; title: string; hint: string }) => (
  // Grid cell takes care of width / gap; the tile only needs to fix its own
  // height and clamp text so longer translations don't push the row taller.
  <Link
    to={to}
    className="card"
    style={{
      height: 84,
      textDecoration: "none",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 4,
    }}
  >
    <div style={{ fontWeight: 700, fontSize: 16, color: "#07ddf1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
    <div className="muted" style={{ fontSize: 12, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{hint}</div>
  </Link>
);

export default BranchHub;
