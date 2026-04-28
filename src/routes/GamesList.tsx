import GameForm from "@/components/games/GameForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { IGameApi } from "@/api/games";
import { useAsync } from "@/hooks/useAsync";
import { gameRepository } from "@/repositories/GameRepository";
import { useState } from "react";

const GamesList = () => {
  const { data, loading, error, reload } = useAsync(() => gameRepository.list(), []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IGameApi | null>(null);

  const remove = async (g: IGameApi) => {
    if (!confirm(`Delete ${g.name}?`)) return;
    await gameRepository.remove(g.id);
    void reload();
  };

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title="Games">
      <div className="row-between">
        <div />
        <Button onClick={() => setCreating(true)}>+ New game</Button>
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
                <Button variant="secondary" onClick={() => setEditing(g)} style={btn}>Edit</Button>
                <Button variant="secondary" onClick={() => remove(g)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>Delete</Button>
              </div>
            </div>
          ))}
          {!data?.length && <div className="muted">No games.</div>}
        </div>
      )}
      {creating && <GameForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {editing && <GameForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </ScreenWithBg>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12 };

export default GamesList;
