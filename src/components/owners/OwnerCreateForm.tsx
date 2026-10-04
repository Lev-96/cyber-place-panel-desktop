import { formatApiError } from "@/api/errors";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { companyRepository } from "@/repositories/CompanyRepository";
import { ownerRepository } from "@/repositories/OwnerRepository";
import { FormEvent, useState } from "react";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

/**
 * The admin adds an owner to a company (`POST /admin/owners`): the company, the
 * person's first and last name, and their email. A company may have several
 * owners. The new
 * owner gets an email link and sets their own password — nobody types one for
 * them. A taken email comes back as a 422 naming the field, shown as the
 * server wrote it.
 */
const OwnerCreateForm = ({ onClose, onSaved }: Props) => {
  const { t } = useLang();
  const { data: companies, loading, error } = useAsync(() => companyRepository.list(), []);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (companyId == null) return setErr(t("owner.errors.companyRequired"));
    setBusy(true);
    setErr(null);
    try {
      await ownerRepository.create({
        company_id: companyId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
      });
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
        <h2 style={{ margin: 0 }}>{t("owner.titleNew")}</h2>
        <label className="col" style={{ gap: 6 }}>
          <span className="label">{t("label.company")}</span>
          <select
            className="input"
            value={companyId ?? ""}
            onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : null)}
            disabled={loading || !!error}
            required
            autoFocus
          >
            <option value="">{loading ? "…" : t("owner.pickCompany")}</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {error && <div className="error">{error.message}</div>}
        <Input label={t("profile.firstName")} value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={120} />
        <Input label={t("profile.lastName")} value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={120} />
        <Input label={t("label.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
        <div className="muted" style={{ fontSize: 13 }}>{t("staff.inviteHint")}</div>
        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy || loading || !!error}>{busy ? "…" : t("owners.add")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default OwnerCreateForm;
