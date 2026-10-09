import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import ImageUpload from "@/components/ui/ImageUpload";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import NumberStepper from "@/components/ui/NumberStepper";
import { COUNTRIES, countryByCode, flagOf, resolveCountryCode } from "@/data/countries";
import { apiGetTinRules } from "@/api/tinRules";
import { buildTinMap, tinExample, validateTin, type TinRuleMap } from "@/data/tin";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { storageUri } from "@/infrastructure/AppConfig";
import { companyRepository } from "@/repositories/CompanyRepository";
import { CompanyStatusType, ICompanyApi } from "@/types/api";
import { FormEvent, useEffect, useState } from "react";

const dialOf = (code: string): string => countryByCode(code)?.dial ?? "";

/** Strip a leading "+<dial>" so the number input shows the national part only. */
const stripDial = (full: string, code: string): string => {
  const dial = dialOf(code);
  const trimmed = full.trim();
  if (dial) {
    const compact = trimmed.replace(/\s+/g, "");
    if (compact.startsWith(`+${dial}`)) return compact.slice(dial.length + 1);
  }
  return trimmed;
};

interface Props {
  initial?: ICompanyApi;
  onClose: () => void;
  onSaved: (c: ICompanyApi) => void;
}

/**
 * Company form mirrors RN cyberplace-panel:
 *   - 2-step create (admin only): step 1 = owner name + email, step 2 = company
 *     multipart with logo. ONE request creates both; the owner gets an email
 *     link to set their own password (nobody types one for them).
 *   - edit: in-place fields, logo optional, status visible only to admin
 */
const CompanyForm = ({ initial, onClose, onSaved }: Props) => {
  const { user } = useAuth();
  const { t } = useLang();
  const isEdit = !!initial;
  const isAdmin = user?.role === "admin";
  const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);

  // Step 1 — owner
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  // Step 2 — company
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  // `phone` holds the national number only; the dial code comes from `country`.
  const [phone, setPhone] = useState(() => stripDial(initial?.phone ?? "", resolveCountryCode(initial?.company_country)));
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

  // Per-country TIN rules from the backend (DB source of truth). Falls back
  // to the bundled static rules in src/data/tin.ts if the fetch fails.
  const [tinRules, setTinRules] = useState<TinRuleMap | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    apiGetTinRules()
      .then((r) => { if (alive) setTinRules(buildTinMap(r.tin_rules)); })
      .catch(() => { /* keep the static fallback */ });
    return () => { alive = false; };
  }, []);

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

  // The country picker and the phone dial-code select are two views of the
  // same `country` state — picking either updates the other, the shown dial
  // code, and TIN validation. The national number (`phone`) is left untouched.
  const onCountryChange = (code: string) => {
    setCountry(code);
    setErr(null);
  };

  // Step 1 only collects the owner; the company create sends both at once.
  const submitStep1 = (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setStep(2);
  };

  const submitStep2 = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEdit && !logo) return setErr(t("company.logoRequired"));
    if (!isEdit && !country) return setErr(t("company.selectCountryFirst"));
    // Per-country TIN validation — block submit on a malformed tax id.
    const tinCheck = validateTin(country, tin, tinRules);
    if (!tinCheck.valid) {
      return setErr(tinCheck.example ? fmt(t("tin.invalid"), tinCheck.example) : t("tin.invalidGeneric"));
    }
    // Strict, offline phone validation for the selected country.
    const parsedPhone = parsePhoneNumberFromString(phone, country as CountryCode);
    if (!parsedPhone || !parsedPhone.isValid()) {
      return setErr(t("branchForm.invalidPhone"));
    }
    // Persist the country as its English name (backend stores free text) so
    // existing displays keep working; the code lives only in form state.
    const countryName = countryByCode(country)?.name ?? country;
    const fullPhone = parsedPhone.formatInternational();
    setBusy(true); setErr(null);
    try {
      const adminFields = isAdmin
        ? { status, commission_percent: Number.isFinite(commission) ? commission : 0 }
        : {};
      const c = isEdit
        ? await companyRepository.update(initial!.id, {
          name, email, phone: fullPhone, company_country: countryName, company_city: city, tin,
          website, description, company_logo_path: logo,
          ...adminFields,
        })
        : await companyRepository.create({
          // The owner is created with the company in the same transaction,
          // so a failed create leaves no half-made account; a retry is safe.
          owner_name: ownerName.trim(), owner_email: ownerEmail.trim(),
          name, email, phone: fullPhone, company_country: countryName, company_city: city, tin,
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
          <Input label={t("company.ownerName")} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required maxLength={255} autoFocus />
          <Input label={t("company.ownerEmail")} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required maxLength={255} />
          <div className="muted" style={{ fontSize: 13 }}>{t("staff.inviteHint")}</div>
          {err && <div className="error" style={{ whiteSpace: "pre-line" }}>{err}</div>}
          <div className="row-between">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
            <Button disabled={busy}>{t("company.next")}</Button>
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
          <div style={{ flex: 1 }}>
            <Input label={t("label.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div style={{ flex: 1 }}>
            <span className="label">{t("label.phone")}</span>
            <div className="row" style={{ gap: 6 }}>
              <select
                className="input"
                style={{ maxWidth: 120 }}
                value={country}
                onChange={(e) => onCountryChange(e.target.value)}
                aria-label={t("branch.country")}
              >
                <option value="">-</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{flagOf(c.code)} +{c.dial}</option>
                ))}
              </select>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={{ flex: 1 }}
              />
            </div>
          </div>
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
          placeholder={tinExample(country, tinRules)}
          required
        />
        <Input label={t("company.website")} value={website} onChange={(e) => setWebsite(e.target.value)} />
        {/* 255 = the backend's limit (companies.description is varchar(255)):
            typing past it could only end in a refused save. */}
        <Input label={t("label.description")} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />

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
              placeholder={t("company.commissionExample")}
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
