import { apiRegisterUser } from "@/api/users";
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import ImageUpload from "@/components/ui/ImageUpload";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import NumberStepper from "@/components/ui/NumberStepper";
import { storageUri } from "@/infrastructure/AppConfig";
import { companyRepository } from "@/repositories/CompanyRepository";
import { CompanyStatusType, ICompanyApi } from "@/types/api";
import { FormEvent, useState } from "react";

interface Props {
  initial?: ICompanyApi;
  onClose: () => void;
  onSaved: (c: ICompanyApi) => void;
}

/**
 * Company form mirrors RN cyberplace-panel:
 *   - 2-step create (admin only): step 1 = owner user, step 2 = company multipart with logo
 *   - edit: in-place fields, logo optional, status visible only to admin
 */
const CompanyForm = ({ initial, onClose, onSaved }: Props) => {
  const { user } = useAuth();
  const isEdit = !!initial;
  const isAdmin = user?.role === "admin";
  const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);

  // Step 1 — owner user
  const [ownerName, setOwnerName] = useState(initial?.user?.name ?? "");
  const [ownerEmail, setOwnerEmail] = useState(initial?.user?.email ?? "");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerPassword2, setOwnerPassword2] = useState("");
  const [userId, setUserId] = useState<number | null>(initial?.user_id ?? null);

  // Step 2 — company
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [country, setCountry] = useState(initial?.company_country ?? "");
  const [city, setCity] = useState(initial?.company_city ?? "");
  const [tin, setTin] = useState(initial?.tin ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [status, setStatus] = useState<CompanyStatusType>(initial?.status ?? "pending");
  const [commission, setCommission] = useState<number>(
    initial?.commission_percent != null ? Number(initial.commission_percent) : 0,
  );
  const [commissionSavedAt, setCommissionSavedAt] = useState<number | null>(null);
  const [commissionSaving, setCommissionSaving] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Persist just the commission_percent to the company without closing the form. */
  const persistCommission = async (v: number) => {
    if (!isEdit || !initial) return;
    if (v === Number(initial.commission_percent ?? 0)) return;
    setCommissionSaving(true); setErr(null);
    try {
      await companyRepository.update(initial.id, { commission_percent: v });
      setCommissionSavedAt(Date.now());
    } catch (e) { setErr(formatError(e)); }
    finally { setCommissionSaving(false); }
  };

  const submitStep1 = async (e: FormEvent) => {
    e.preventDefault();
    if (ownerPassword !== ownerPassword2) return setErr("Passwords do not match");
    setBusy(true); setErr(null);
    try {
      const r = await apiRegisterUser({
        name: ownerName, email: ownerEmail,
        password: ownerPassword, password_confirmation: ownerPassword2,
      });
      setUserId(r.register.id);
      setStep(2);
    } catch (e) { setErr(formatError(e)); }
    finally { setBusy(false); }
  };

  const submitStep2 = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEdit && !logo) return setErr("Logo is required for a new company");
    if (!isEdit && !userId) return setErr("Owner user not created yet");
    setBusy(true); setErr(null);
    try {
      const adminFields = isAdmin
        ? { status, commission_percent: Number.isFinite(commission) ? commission : 0 }
        : {};
      const c = isEdit
        ? await companyRepository.update(initial!.id, {
          name, email, phone, company_country: country, company_city: city, tin,
          website, description, company_logo_path: logo,
          ...adminFields,
        })
        : await companyRepository.create({
          user_id: userId!, name, email, phone, company_country: country, company_city: city, tin,
          website, description, company_logo_path: logo!,
          ...adminFields,
        });
      onSaved(c.raw);
    } catch (e) { setErr(formatError(e)); }
    finally { setBusy(false); }
  };

  if (step === 1 && !isEdit) {
    return (
      <Modal open onClose={onClose}>
        <form className="card" style={cardStyle} onSubmit={submitStep1}>
          <div className="row-between"><h2 style={{ margin: 0 }}>New company · step 1/2</h2><span className="muted">Owner</span></div>
          <Input label="Owner full name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required autoFocus />
          <Input label="Owner email" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
          <Input label="Password" type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required minLength={8} />
          <Input label="Confirm password" type="password" value={ownerPassword2} onChange={(e) => setOwnerPassword2(e.target.value)} required minLength={8} />
          {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
          <div className="row-between">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button disabled={busy}>{busy ? "Creating owner…" : "Next"}</Button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={cardStyle} onSubmit={submitStep2}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>{isEdit ? "Edit company" : "New company · step 2/2"}</h2>
          {!isEdit && <span className="muted">Company</span>}
        </div>

        <Input label="Company name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} autoFocus />
        <div className="row" style={{ gap: 10 }}>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} required />
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <Input label="TIN" value={tin} onChange={(e) => setTin(e.target.value)} required />
        <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

        {isAdmin && (
          <>
            <div className="col" style={{ gap: 6 }}>
              <span className="label">Status (admin only)</span>
              <div className="row" style={{ gap: 6 }}>
                {(["pending", "active"] as CompanyStatusType[]).map((s) => (
                  <Button key={s} type="button" variant={status === s ? "primary" : "secondary"} onClick={() => setStatus(s)} style={{ flex: 1 }}>{s}</Button>
                ))}
              </div>
            </div>
            <NumberStepper
              label="Commission % (admin only)"
              value={commission}
              onChange={setCommission}
              onCommit={isEdit ? persistCommission : undefined}
              min={0}
              max={100}
              step={1}
              precision={2}
              placeholder="e.g. 2"
              suffix="%"
              disabled={commissionSaving}
            />
            <span className="muted" style={{ fontSize: 11, marginTop: -6 }}>
              Owner pays this percent of monthly gross revenue to Cyber Place.
              {isEdit && commissionSaving && " Saving…"}
              {isEdit && !commissionSaving && commissionSavedAt && " Saved."}
            </span>
          </>
        )}

        <ImageUpload
          label={isEdit ? "Replace logo (optional)" : "Logo"}
          required={!isEdit}
          name={name}
          initialUrl={initial ? storageUri(initial.company_logo_path) : null}
          onChange={setLogo}
        />

        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          {!isEdit && <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={busy}>← Back</Button>}
          <div className="row" style={{ gap: 8 }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button disabled={busy}>{busy ? "Saving…" : (isEdit ? "Save" : "Create company")}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

const formatError = (e: unknown): string => {
  if (typeof e === "object" && e && "body" in e) {
    const body = (e as { body?: unknown }).body;
    if (body && typeof body === "object") {
      const errs = (body as { errors?: unknown }).errors ?? body;
      if (errs && typeof errs === "object") {
        const lines: string[] = [];
        for (const [k, v] of Object.entries(errs as Record<string, unknown>)) {
          if (Array.isArray(v)) lines.push(`${k}: ${v.join("; ")}`);
        }
        if (lines.length) return lines.join("\n");
      }
      const m = (body as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
  }
  return e instanceof Error ? e.message : "Failed";
};

const cardStyle: React.CSSProperties = {
  width: 540, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 12,
};

export default CompanyForm;
