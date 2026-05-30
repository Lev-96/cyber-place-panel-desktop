import { apiRegisterUser } from "@/api/users";
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import ImageUpload from "@/components/ui/ImageUpload";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import NumberStepper from "@/components/ui/NumberStepper";
import { COUNTRIES, countryByCode, flagOf, resolveCountryCode } from "@/data/countries";
import { tinExample, validateTin } from "@/data/tin";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
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
  const { t } = useLang();
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
  // `country` holds the ISO alpha-2 code (drives the picker, the phone
  // dial-code prefill and TIN validation). Legacy free-text values are
  // resolved back to a code so editing still pre-selects the dropdown.
  const [country, setCountry] = useState(resolveCountryCode(initial?.company_country));
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

  // Selecting a country prefills the phone field with its dialling code.
  // We only overwrite when the phone is empty or still holds the previous
  // country's bare code — a number the admin already typed is never clobbered.
  const onCountryChange = (code: string) => {
    const prevDial = countryByCode(country)?.dial ?? "";
    const nextDial = countryByCode(code)?.dial ?? "";
    setCountry(code);
    setErr(null);
    setPhone((p) => {
      const tr = p.trim();
      if (!tr || tr === `+${prevDial}` || tr === `+${prevDial} `) {
        return nextDial ? `+${nextDial} ` : "";
      }
      return p;
    });
  };

  // Step 1 no longer hits the API — it just validates locally and advances.
  // Owner registration moved to the final step (submitStep2) so the backend
  // welcome email fires only once the whole company is actually created,
  // not the moment "Next" is pressed.
  const submitStep1 = (e: FormEvent) => {
    e.preventDefault();
    if (ownerPassword !== ownerPassword2) return setErr(t("settings.passwordsMismatch"));
    setErr(null);
    setStep(2);
  };

  const submitStep2 = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEdit && !logo) return setErr(t("company.logoRequired"));
    if (!isEdit && !country) return setErr(t("company.selectCountryFirst"));
    // Per-country TIN validation — block submit on a malformed tax id.
    const tinCheck = validateTin(country, tin);
    if (!tinCheck.valid) {
      return setErr(tinCheck.example ? fmt(t("tin.invalid"), tinCheck.example) : t("tin.invalidGeneric"));
    }
    // Persist the country as its English name (backend stores free text) so
    // existing displays keep working; the code lives only in form state.
    const countryName = countryByCode(country)?.name ?? country;
    setBusy(true); setErr(null);
    try {
      // Register the owner here (not in step 1). Guard with userId so a retry
      // after a failed company-create doesn't register — and email — twice.
      let uid = userId;
      if (!isEdit && uid == null) {
        const r = await apiRegisterUser({
          name: ownerName, email: ownerEmail,
          password: ownerPassword, password_confirmation: ownerPassword2,
        });
        uid = r.register.id;
        setUserId(uid);
      }
      const adminFields = isAdmin
        ? { status, commission_percent: Number.isFinite(commission) ? commission : 0 }
        : {};
      const c = isEdit
        ? await companyRepository.update(initial!.id, {
          name, email, phone, company_country: countryName, company_city: city, tin,
          website, description, company_logo_path: logo,
          ...adminFields,
        })
        : await companyRepository.create({
          user_id: uid!, name, email, phone, company_country: countryName, company_city: city, tin,
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
          <div className="row-between"><h2 style={{ margin: 0 }}>{t("company.titleNew")} · {t("company.step1")}</h2><span className="muted">{t("company.owner")}</span></div>
          <Input label={t("company.ownerName")} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required autoFocus />
          <Input label={t("company.ownerEmail")} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
          <Input label={t("auth.password")} type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required minLength={8} />
          <Input label={t("label.confirmPassword")} type="password" value={ownerPassword2} onChange={(e) => setOwnerPassword2(e.target.value)} required minLength={8} />
          {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
          <div className="row-between">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
            <Button disabled={busy}>{busy ? t("company.creatingOwner") : t("company.next")}</Button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={cardStyle} onSubmit={submitStep2}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>{isEdit ? t("company.titleEdit") : `${t("company.titleNew")} · ${t("company.step2")}`}</h2>
          {!isEdit && <span className="muted">{t("company.section")}</span>}
        </div>

        <Input label={t("company.name")} value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} autoFocus />
        <div className="row" style={{ gap: 10 }}>
          <Input label={t("label.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label={t("label.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <span className="label">{t("branch.country")}</span>
            <select
              className="input"
              value={country}
              onChange={(e) => onCountryChange(e.target.value)}
              required
            >
              <option value="">{t("company.selectCountry")}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{flagOf(c.code)} {c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <Input label={t("branch.city")} value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
        </div>
        <Input
          label={t("company.tin")}
          value={tin}
          onChange={(e) => setTin(e.target.value)}
          placeholder={tinExample(country)}
          required
        />
        <Input label={t("company.website")} value={website} onChange={(e) => setWebsite(e.target.value)} />
        <Input label={t("label.description")} value={description} onChange={(e) => setDescription(e.target.value)} />

        {isAdmin && (
          <>
            <div className="col" style={{ gap: 6 }}>
              <span className="label">{t("company.statusAdmin")}</span>
              <div className="row" style={{ gap: 6 }}>
                {(["pending", "active"] as CompanyStatusType[]).map((s) => (
                  <Button key={s} type="button" variant={status === s ? "primary" : "secondary"} onClick={() => setStatus(s)} style={{ flex: 1 }}>{s}</Button>
                ))}
              </div>
            </div>
            <NumberStepper
              label={t("company.commissionAdmin")}
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
              {t("company.commissionHint")}
              {isEdit && commissionSaving && ` ${t("company.saving")}`}
              {isEdit && !commissionSaving && commissionSavedAt && ` ${t("company.saved")}`}
            </span>
          </>
        )}

        <ImageUpload
          label={isEdit ? t("company.replaceLogo") : t("company.logo")}
          required={!isEdit}
          name={name}
          initialUrl={initial ? storageUri(initial.company_logo_path) : null}
          onChange={setLogo}
        />

        {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
        <div className="row-between">
          {!isEdit && <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={busy}>{t("company.back")}</Button>}
          <div className="row" style={{ gap: 8 }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
            <Button disabled={busy}>{busy ? "…" : (isEdit ? t("action.save") : t("company.create"))}</Button>
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
