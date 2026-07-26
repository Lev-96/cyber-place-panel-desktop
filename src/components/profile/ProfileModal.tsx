import { apiUpdateUser } from "@/api/users";
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import EmailChangeCard from "@/components/profile/EmailChangeCard";
import PasswordChangeCard from "@/components/profile/PasswordChangeCard";
import { useLang } from "@/i18n/LanguageContext";
import { FormEvent, useState } from "react";

/** Split the single stored `name` into first + last for editing. */
const splitName = (name: string): [string, string] => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return ["", ""];
  const [f, ...rest] = parts;
  return [f, rest.join(" ")];
};

const ProfileModal = ({ onClose }: { onClose: () => void }) => {
  const { user, refreshUser } = useAuth();
  const { t } = useLang();
  const [initFirst, initLast] = splitName(user?.name ?? "");
  const [first, setFirst] = useState(initFirst);
  const [last, setLast] = useState(initLast);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user) return null;

  const joined = [first.trim(), last.trim()].filter(Boolean).join(" ");
  const dirty = joined !== (user.name ?? "").trim();
  const roleLabel = t(`role.${user.role}`) || user.role;

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!joined) { setMsg({ ok: false, text: t("profile.nameRequired") }); return; }
    setBusy(true); setMsg(null);
    try {
      // Send the unchanged email alongside the new name — the users endpoint
      // requires both, and email changes go through their own verified flow.
      await apiUpdateUser(user.id, { name: joined, email: user.email });
      await refreshUser();
      setMsg({ ok: true, text: t("profile.saved") });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t("form.errors.failedSave") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="card col" style={{ width: 520, maxWidth: "92vw", gap: 16 }}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>{t("profile.title")}</h2>
          <span className="chip">{roleLabel}</span>
        </div>

        <form className="col" style={{ gap: 12 }} onSubmit={saveName}>
          <div className="row" style={{ gap: 10 }}>
            <Input label={t("profile.firstName")} value={first} onChange={(e) => setFirst(e.target.value)} />
            <Input label={t("profile.lastName")} value={last} onChange={(e) => setLast(e.target.value)} />
          </div>

          {msg && <div className={msg.ok ? "muted" : "error"}>{msg.text}</div>}
          <div className="row-between">
            <span />
            <Button disabled={busy || !dirty}>{busy ? "…" : t("action.save")}</Button>
          </div>
        </form>

        <EmailChangeCard currentEmail={user.email} />
        <PasswordChangeCard email={user.email} />

        <div className="row-between">
          <Button variant="secondary" onClick={onClose}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProfileModal;
