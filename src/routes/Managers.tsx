import ManagerForm from "@/components/managers/ManagerForm";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { managerRepository } from "@/repositories/ManagerRepository";
import { IManagerApi } from "@/api/managers";
import { useState } from "react";
import { useParams } from "react-router-dom";

const Managers = () => {
  const { t } = useLang();
  const { branchId } = useParams();
  const id = Number(branchId);
  const branchScoped = Number.isFinite(id) && id > 0;
  const { data, loading, error, reload } = useAsync(
    () => branchScoped ? managerRepository.listByBranch(id) : managerRepository.list(),
    [id],
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IManagerApi | null>(null);

  const remove = async (m: IManagerApi) => {
    if (!confirm(`${t("managers.confirmRemove")} — ${m.user?.name ?? ""}?`)) return;
    await managerRepository.remove(m.id);
    void reload();
  };

  return (
    <ScreenWithBg bg="./bg/owner-home.jpg" title={branchScoped ? `${t("managers.title")} · #${id}` : t("managers.title")}>
      {branchScoped && (
        <div className="row-between">
          <div />
          <Button onClick={() => setCreating(true)}>{t("managers.new")}</Button>
        </div>
      )}
      {loading && <Spinner />}
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
                <Button variant="secondary" onClick={() => remove(m)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>{t("action.remove")}</Button>
              </div>
            </div>
          ))}
          {!data?.length && <div className="muted">{t("common.empty.managers")}</div>}
        </div>
      )}
      {creating && branchScoped && (
        <ManagerForm branchId={id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />
      )}
      {editing && (
        <ManagerForm
          branchId={editing.branch_id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
    </ScreenWithBg>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default Managers;
