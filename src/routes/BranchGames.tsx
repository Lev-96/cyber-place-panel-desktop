import GameForm from "@/components/games/GameForm";
import Button from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { IGameApi } from "@/api/games";
import { useAsync } from "@/hooks/useAsync";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { gameRepository } from "@/repositories/GameRepository";
import { platformLabel } from "@/utils/platform";
import { useState } from "react";
import { useParams } from "react-router-dom";

/**
 * Branch-scoped games catalogue. Mirrors the global GamesList but lists and
 * creates games attached to THIS branch via the game_branches pivot, so the
 * staff running the branch — owner AND manager — can build its own library
 * (incl. custom-platform games) without touching the shared admin catalogue.
 */
const BranchGames = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t } = useLang();
  const { user } = useAuth();
  const confirm = useConfirm();
  // Renaming / deleting touches the SHARED catalogue row, which other
  // companies' branches may also use — admin-only, exactly what the backend
  // services enforce. Owners and managers add games to their own library.
  const canEditCatalog = can(user?.role, "game.crud");
  const { data, loading, error, reload } = useAsync(() => gameRepository.list({ branchId: id }), [id]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IGameApi | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const remove = async (g: IGameApi) => {
    if (!(await confirm(`${t("action.delete")} ${g.name}?`, { destructive: true }))) return;
    await gameRepository.remove(g.id);
    void reload();
  };

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={`${t("branchGames.title")} · №${id}`}>
      <div className="row-between">
        <span className="muted">{t("branchGames.intro")}</span>
        <Button onClick={() => setCreating(true)}>{t("games.new")}</Button>
      </div>
      {loading && <ListSkeleton />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(data ?? []).map((g) => (
            <div key={g.id} className="list-item">
              <div>
                <div className="name">{g.name}</div>
                <div className="meta">{platformLabel(g.platform)}</div>
              </div>
              {canEditCatalog && (
                <div className="row" style={{ gap: 6 }}>
                  <Button variant="secondary" onClick={() => setEditing(g)} style={btn}>{t("action.edit")}</Button>
                  <Button variant="secondary" onClick={() => remove(g)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>{t("action.delete")}</Button>
                </div>
              )}
            </div>
          ))}
          {!data?.length && <div className="muted">{t("branchGames.empty")}</div>}
        </div>
      )}
      {creating && <GameForm branchId={id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {editing && <GameForm initial={editing} branchId={id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </ScreenWithBg>
  );
};

// Fixed-width buttons so the row doesn't jitter when switching EN/RU/AM.
const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default BranchGames;
