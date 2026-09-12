import { formatApiError } from "@/api/errors";
import type { IOwnerApi } from "@/api/owners";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/i18n/LanguageContext";
import { ownerRepository } from "@/repositories/OwnerRepository";
import { FormEvent, useEffect, useRef, useState } from "react";

interface Props {
  owner: IOwnerApi;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Correct an owner's name or email (`PUT /admin/owners/{id}`). The same two
 * fields the manager edit offers, and no password — the reset flow stays the
 * way a password changes. A taken email comes back as a 422 naming the field,
 * shown as the server wrote it.
 */
const OwnerForm = ({ owner, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [name, setName] = useState(owner.name);
  const [email, setEmail] = useState(owner.email);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  // `autoFocus` is unreliable in Electron after another modal closed — the
  // same explicit focus ManagerForm uses.
  useEffect(() => {
    const id = window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await ownerRepository.update(owner.id, { name: name.trim(), email: email.trim() });
      onSaved();
    } catch (error) {
      setErr(formatApiError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <form
        className="card"
        style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 16 }}
        onSubmit={submit}
      >
        <h2 style={{ margin: 0 }}>{t("owner.titleEdit")}</h2>
        <Input ref={nameRef} label={t("label.name")} value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} />
        <Input label={t("label.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default OwnerForm;
