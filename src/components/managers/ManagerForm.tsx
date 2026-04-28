import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { branchRepository } from "@/repositories/BranchRepository";
import { managerRepository } from "@/repositories/ManagerRepository";
import { IManagerApi } from "@/api/managers";
import { FormEvent, useEffect, useState } from "react";

interface Props {
  branchId: number;
  initial?: IManagerApi;
  onClose: () => void;
  onSaved: () => void;
}

const ManagerForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.user?.name ?? "");
  const [email, setEmail] = useState(initial?.user?.email ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(initial?.company_id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        if (pw !== pw2) { setErr("Passwords do not match"); setBusy(false); return; }
        if (!companyId) { setErr("Company not resolved yet — try again"); setBusy(false); return; }
        await managerRepository.create({
          branch_id: branchId,
          company_id: companyId,
          name, email,
          password: pw, password_confirmation: pw2,
        });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{isEdit ? "Edit manager" : "New manager"}</h2>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {!isEdit && <>
          <Input label="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
          <Input label="Confirm password" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} />
        </>}
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy}>{busy ? "Saving…" : (isEdit ? "Save" : "Create")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ManagerForm;
