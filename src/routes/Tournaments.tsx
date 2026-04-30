import TournamentForm from "@/components/tournaments/TournamentForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { ITournamentApi } from "@/api/tournaments";
import { useAsync } from "@/hooks/useAsync";
import { tournamentRepository } from "@/repositories/TournamentRepository";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

const Tournaments = () => {
  const { user } = useAuth();

  const { branchId } = useParams();
  const id = Number(branchId);
  const isBranchScoped = Number.isFinite(id) && id > 0;
  const { data, loading, error, reload } = useAsync(
    () => tournamentRepository.list(isBranchScoped ? id : undefined),
    [id],
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ITournamentApi | null>(null);

  const remove = async (t: ITournamentApi) => {
    if (!confirm(`Delete tournament "${t.title}"?`)) return;
    await tournamentRepository.remove(t.id);
    void reload();
  };

  return (
    <ScreenWithBg
      bg="./bg/owner-home.jpg"
      title={isBranchScoped ? `Tournaments · branch #${id}` : "Tournaments"}
    >
      {isBranchScoped && (
        <div className="row-between">
          <div />
          <Button onClick={() => setCreating(true)}>+ New tournament</Button>
        </div>
      )}
      {!isBranchScoped && (
        <div className="muted">
          Open a branch and click "Tournaments" to create one. Tournaments
          belong to a specific branch.
        </div>
      )}

      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(data ?? []).map((t) => (
            <div key={t.id} className="list-item">
              <div>
                <div className="name">{t.title}</div>
                <div className="meta">
                  {t.start_date}
                  {t.end_date ? ` — ${t.end_date}` : ""}
                  {t.price != null && (
                    <> · price: {Number(t.price).toFixed(2)}</>
                  )}
                  {t.participants_limit ? (
                    <>
                      {" "}
                      · {t.registered_participants}/{t.participants_limit}{" "}
                      players
                    </>
                  ) : null}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Link to={`/tournaments/${t.id}`} className="muted" style={btn}>
                  Open
                </Link>
                {user?.role && ["admin", "owner"].includes(user?.role) && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setEditing(t)}
                      style={btn}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => remove(t)}
                      style={{
                        ...btn,
                        color: "#ef4444",
                        borderColor: "#4a1a1a",
                      }}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!data?.length && <div className="muted">No tournaments.</div>}
        </div>
      )}
      {creating && isBranchScoped && (
        <TournamentForm
          branchId={id}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void reload();
          }}
        />
      )}
      {editing && (
        <TournamentForm
          branchId={editing.branch_id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </ScreenWithBg>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12 };

export default Tournaments;
