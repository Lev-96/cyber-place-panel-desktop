import ManagerForm from "@/components/managers/ManagerForm";
import BranchPickerModal from "@/components/managers/BranchPickerModal";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { managerRepository } from "@/repositories/ManagerRepository";
import { IManagerApi } from "@/api/managers";
import { useState } from "react";
import { useParams } from "react-router-dom";

const Managers = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const { branchId } = useParams();
  const id = Number(branchId);
  const branchScoped = Number.isFinite(id) && id > 0;
  const canCreate = can(user?.role, "manager.create");
  const { data, loading, error, reload } = useAsync(
    () => branchScoped ? managerRepository.listByBranch(id) : managerRepository.list(),
    [id],
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IManagerApi | null>(null);
  const [pendingRemove, setPendingRemove] = useState<IManagerApi | null>(null);
  /**
   * The branch a NEW manager is being created for.
   *
   * Inside a branch the URL already answers it. On the sidebar screen it does
   * not, and a manager row is meaningless without one — a manager IS their
   * branch. So the button opens a picker there instead of a form, and the
   * picker resolves itself when the owner has exactly one branch: asking a
   * question with one possible answer is not a choice, it is a click.
   */
  const [createForBranch, setCreateForBranch] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    const m = pendingRemove;
    setPendingRemove(null);
    await managerRepository.remove(m.id);
    void reload();
  };

  return (
    <ScreenWithBg bg="./bg/owner-home.jpg" title={branchScoped ? `${t("managers.title")} · №${id}` : t("managers.title")}>
      {canCreate && (
        <div className="row-between">
          <div />
          <Button onClick={() => (branchScoped ? setCreating(true) : setPicking(true))}>
            {t("managers.new")}
          </Button>
        </div>
      )}
      {loading && <ListSkeleton />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(data ?? []).map((m) => (
            <div key={m.id} className="list-item">
              <div>
                <div className="name">{m.user?.name ?? "—"}</div>
                <div className="meta">{m.user?.email ?? "—"} {m.branch && <>· {t("managers.branchLabel")} {m.branch.address}</>}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button variant="secondary" onClick={() => setEditing(m)} style={btn}>{t("action.edit")}</Button>
                <Button variant="secondary" onClick={() => setPendingRemove(m)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>{t("action.remove")}</Button>
              </div>
            </div>
          ))}
          {!data?.length && <div className="muted">{t("common.empty.managers")}</div>}
        </div>
      )}
      {creating && branchScoped && (
        <ManagerForm branchId={id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />
      )}
      {picking && (
        <BranchPickerModal
          onClose={() => setPicking(false)}
          onPicked={(pickedBranchId) => {
            setPicking(false);
            setCreateForBranch(pickedBranchId);
          }}
        />
      )}
      {createForBranch != null && (
        <ManagerForm
          branchId={createForBranch}
          onClose={() => setCreateForBranch(null)}
          onSaved={() => { setCreateForBranch(null); void reload(); }}
        />
      )}
      {editing && (
        <ManagerForm
          branchId={editing.branch_id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
      <ConfirmDialog
        open={!!pendingRemove}
        message={`${t("managers.confirmRemove")} — ${pendingRemove?.user?.name ?? ""}?`}
        confirmLabel={t("action.remove")}
        cancelLabel={t("action.cancel")}
        destructive
        onConfirm={() => void confirmRemove()}
        onCancel={() => setPendingRemove(null)}
      />
    </ScreenWithBg>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default Managers;
