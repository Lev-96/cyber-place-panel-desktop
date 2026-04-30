import ServiceForm from "@/components/services/ServiceForm";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { serviceRepository } from "@/repositories/ServiceRepository";
import { IBranchService } from "@/types/api";
import { useState } from "react";

const ServicesAdmin = () => {
  const { t, money } = useLang();
  const { data, loading, error, reload } = useAsync(() => serviceRepository.listAll(), []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IBranchService | null>(null);

  const remove = async (s: IBranchService) => {
    if (!confirm(`${t("servicesAdmin.confirmDelete")} "${s.name_en}"?`)) return;
    await serviceRepository.remove(s.id);
    void reload();
  };

  return (
    <ScreenWithBg bg="./bg/admin-home.jpg" title={t("servicesAdmin.title")}>
      <div className="row-between">
        <span className="muted">{t("servicesAdmin.subtitle")}</span>
        <Button onClick={() => setCreating(true)}>{t("servicesAdmin.new")}</Button>
      </div>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(data ?? []).map((s) => (
            <div key={s.id} className="list-item">
              <div className="row" style={{ gap: 12, flex: 1 }}>
                <Avatar src={s.service_logo_path} name={s.name_en} size={44} />
                <div style={{ flex: 1 }}>
                  <div className="name">{s.name_en}</div>
                  <div className="meta">{s.name_ru} · {s.name_am}{s.price != null ? ` · ${money(Number(s.price))}` : ""}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button variant="secondary" onClick={() => setEditing(s)} style={btn}>{t("action.edit")}</Button>
                <Button variant="secondary" onClick={() => remove(s)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>{t("action.delete")}</Button>
              </div>
            </div>
          ))}
          {!data?.length && <div className="muted">{t("common.empty.companies")}</div>}
        </div>
      )}
      {creating && <ServiceForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {editing && <ServiceForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </ScreenWithBg>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default ServicesAdmin;
