import GameForm from "@/components/games/GameForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { IGameApi } from "@/api/games";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { gameRepository } from "@/repositories/GameRepository";
import { useState } from "react";

const GamesList = () => {
  const { t } = useLang();
  const { data, loading, error, reload } = useAsync(() => gameRepository.list(), []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IGameApi | null>(null);

  const remove = async (g: IGameApi) => {
    if (!confirm(`${t("action.delete")} ${g.name}?`)) return;
    await gameRepository.remove(g.id);
    void reload();
  };

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title={t("games.title")}>
      <div className="row-between">
        <div />
        <Button onClick={() => setCreating(true)}>{t("games.new")}</Button>
      </div>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(data ?? []).map((g) => (
            <div key={g.id} className="list-item">
              <div>
                <div className="name">{g.name}</div>
                <div className="meta">{g.platform.toUpperCase()}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button variant="secondary" onClick={() => setEditing(g)} style={btn}>{t("action.edit")}</Button>
                <Button variant="secondary" onClick={() => remove(g)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>{t("action.delete")}</Button>
              </div>
            </div>
          ))}
          {!data?.length && <div className="muted">{t("common.empty.games")}</div>}
        </div>
      )}
      {creating && <GameForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {editing && <GameForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </ScreenWithBg>
  );
};

// Buttons stay the same width regardless of language so the row doesn't jitter
// when switching EN/RU/AM (Russian "Удалить" is 7 chars; Armenian "Ջնջել" is 5).
const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default GamesList;
