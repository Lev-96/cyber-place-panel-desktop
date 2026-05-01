import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { branchRepository } from "@/repositories/BranchRepository";
import { managerRepository } from "@/repositories/ManagerRepository";
import { IManagerApi } from "@/api/managers";
import { FormEvent, useEffect, useRef, useState } from "react";

interface Props {
  branchId: number;
  initial?: IManagerApi;
  onClose: () => void;
  onSaved: () => void;
}

const ManagerForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.user?.name ?? "");
  const [email, setEmail] = useState(initial?.user?.email ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(initial?.company_id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  // Force-focus the first input after mount. The native `autoFocus` prop is
  // unreliable in Electron after a previous modal/native-confirm closed —
  // calling .focus() explicitly inside a microtask works around it.
  useEffect(() => {
    const id = window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Auto-derive company_id from branch (manager belongs to a branch which belongs to a company).
  useEffect(() => {
    if (isEdit || companyId) return;
    void branchRepository.byId(branchId).then((b) => setCompanyId(b.company_id)).catch(() => {});
  }, [isEdit, companyId, branchId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (isEdit) {
        await managerRepository.update(initial!.id, { name, email });
      } else {
        if (pw !== pw2) { setErr(t("settings.passwordsMismatch")); setBusy(false); return; }
        if (!companyId) { setErr(t("manager.errors.companyMissing")); setBusy(false); return; }
        await managerRepository.create({
          branch_id: branchId,
          company_id: companyId,
          name, email,
          password: pw, password_confirmation: pw2,
        });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("form.errors.failed"));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{isEdit ? t("manager.titleEdit") : t("manager.titleNew")}</h2>
        <Input ref={nameRef} label={t("label.name")} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label={t("label.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {!isEdit && <>
          <Input label={t("auth.password")} type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
          <Input label={t("label.confirmPassword")} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} />
        </>}
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : (isEdit ? t("action.save") : t("action.create"))}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ManagerForm;
