import TournamentForm from "@/components/tournaments/TournamentForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import Pagination from "@/components/ui/Pagination";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ITournamentApi, SkillLevel } from "@/api/tournaments";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { tournamentRepository } from "@/repositories/TournamentRepository";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

// Single source of truth for skill-chip palette — keeps the cards
// readable at a glance (any/beginner = calm tones, intermediate =
// caution amber, professional = hot red) and lets a future bracket
// inherit a defined fallback by simply adding a row here.
const SKILL_TONES: Record<SkillLevel, { bg: string; fg: string; border: string }> = {
  any:          { bg: "rgba(148, 163, 184, 0.14)", fg: "#94a3b8", border: "rgba(148, 163, 184, 0.50)" },
  beginner:     { bg: "rgba(34, 197, 94, 0.14)",   fg: "#22c55e", border: "rgba(34, 197, 94, 0.50)" },
  intermediate: { bg: "rgba(245, 158, 11, 0.14)",  fg: "#f59e0b", border: "rgba(245, 158, 11, 0.50)" },
  professional: { bg: "rgba(239, 68, 68, 0.14)",   fg: "#ef4444", border: "rgba(239, 68, 68, 0.50)" },
};

const Tournaments = () => {
  const { user } = useAuth();
  const { t: tr } = useLang();
  const confirm = useConfirm();

  const { branchId } = useParams();
  const id = Number(branchId);
  const isBranchScoped = Number.isFinite(id) && id > 0;

  let filterParams: {
    branch_id?: number;
    // company_id?: number
  } = {};

  if (user?.role === "manager" && user.dashboard?.branch_id) {
    filterParams.branch_id = user.dashboard.branch_id;
  }
  // else if (user?.role === "company_owner" && user.dashboard?.company_id) {
  //   filterParams.company_id = user.dashboard.company_id;
  // }

  // If a branchId is in the route (e.g., branch-scoped), it overrides the manager's branch scope for listing
  // (if this is NOT the desired effect, simply use filterParams as above and ignore branchId)
  if (isBranchScoped) {
    filterParams.branch_id = id;
    // delete filterParams.company_id;
  }

  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () => tournamentRepository.listPaged(page, filterParams.branch_id),
    // dependencies: update if user, branchId or page changes
    [
      page,
      user?.role,
      user?.dashboard?.branch_id,
      user?.dashboard?.company_id,
      id,
      isBranchScoped,
    ],
  );
  const tournaments = data?.data ?? [];
  const lastPage = data?.meta?.last_page ?? 1;

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ITournamentApi | null>(null);
  const [removeErr, setRemoveErr] = useState<string | null>(null);

  const remove = async (t: ITournamentApi) => {
    if (!(await confirm(`${tr("tournaments.confirmDelete")} "${t.title}"?`, { destructive: true }))) return;
    // Without try/catch the previous version awaited the API call and
    // silently dropped any 4xx (e.g. role-check 403 from
    // CheckRoleForTournamentService) — the page neither showed an
    // error nor reloaded, which read to the user as "Delete does
    // nothing". Surface the backend message + skip the reload on
    // failure so the row stays visible.
    setRemoveErr(null);
    try {
      await tournamentRepository.remove(t.id);
    } catch (e) {
      setRemoveErr(
        e instanceof Error
          ? e.message
          : tr("common.actionFailed") || "Action failed",
      );
      return;
    }
    void reload();
  };

  return (
    <ScreenWithBg
      bg="./bg/owner-home.jpg"
      title={isBranchScoped ? `${tr("tournaments.title")} · №${id}` : tr("tournaments.title")}
    >
      {isBranchScoped && (
        <div className="row-between">
          <div />
          <Button onClick={() => setCreating(true)}>{tr("tournaments.new")}</Button>
        </div>
      )}
      {!isBranchScoped && (
        <div className="muted">
          {tr("tournaments.scopeHint")}
        </div>
      )}

      {loading && <ListSkeleton />}
      {error && <div className="error">{error.message}</div>}
      {removeErr && <div className="error">{removeErr}</div>}
      {!loading && !error && (
        <div style={{ display: "grid", gap: 12 }}>
          {tournaments.map((t) => {
            const skill = (t.skill_level ?? "any") as SkillLevel;
            const tone = SKILL_TONES[skill] ?? SKILL_TONES.any;
            // Clamp + guard against participants_limit=0 (would otherwise
            // divide by zero and paint a NaN-width bar).
            const filledPct =
              t.participants_limit && t.participants_limit > 0
                ? Math.min(100, Math.max(0, (t.registered_participants / t.participants_limit) * 100))
                : 0;
            const canManage =
              isBranchScoped &&
              !!user?.role &&
              ["admin", "company_owner"].includes(user.role);
            return (
              <div key={t.id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16, flex: 1, minWidth: 0 }}>
                    {t.title}
                  </div>
                  <span
                    style={{
                      ...chipStyle,
                      background: tone.bg,
                      color: tone.fg,
                      border: `1px solid ${tone.border}`,
                    }}
                  >
                    {tr(`tournament.skillLevel.${skill}`)}
                  </span>
                </div>

                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {t.start_date}
                  {t.end_date ? ` — ${t.end_date}` : ""}
                  {t.price != null && (
                    <>
                      {" · "}
                      <span style={{ color: "#e5e7eb", fontWeight: 600 }}>
                        {tr("tournaments.price")}: {Number(t.price).toFixed(2)}
                      </span>
                    </>
                  )}
                </div>

                {t.participants_limit ? (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span className="muted">{tr("tournaments.players")}</span>
                      <span style={{ color: "#e5e7eb", fontWeight: 600 }}>
                        {t.registered_participants}/{t.participants_limit}
                      </span>
                    </div>
                    <div style={progressTrackStyle}>
                      <div
                        style={{
                          ...progressFillStyle,
                          width: `${filledPct}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Actions only inside the branch-scoped management
                    surface (`/branches/:id/tournaments`). The global
                    `/tournaments` catalogue stays purely informational
                    so owners flipping between branches don't see a
                    forest of cross-branch buttons. */}
                {isBranchScoped && (
                  <div
                    className="row"
                    style={{ gap: 6, marginTop: 12, justifyContent: "flex-end" }}
                  >
                    <Link to={`/tournaments/${t.id}`} className="muted" style={btn}>
                      {tr("common.open").replace(" →", "")}
                    </Link>
                    {canManage && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => setEditing(t)}
                          style={btn}
                        >
                          {tr("action.edit")}
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
                          {tr("action.delete")}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!tournaments.length && <div className="muted">{tr("common.empty.tournaments")}</div>}
        </div>
      )}
      {!error && <Pagination page={page} lastPage={lastPage} onChange={setPage} disabled={loading} />}
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

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

// Card chrome — matches `list-item` shell tones but loses the
// `cursor: pointer` since the global view is read-only. Kept inline
// to scope the styling to this file and avoid drift in global.css.
const cardStyle: React.CSSProperties = {
  background: "#0b1224",
  border: "1px solid #1f2a44",
  borderRadius: 12,
  padding: "14px 16px",
  transition: "border-color 160ms, transform 160ms",
};

const chipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  whiteSpace: "nowrap",
};

const progressTrackStyle: React.CSSProperties = {
  height: 6,
  borderRadius: 3,
  background: "rgba(31, 42, 68, 0.6)",
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #07ddf1, #5b8af8)",
  transition: "width 320ms ease",
};

export default Tournaments;
