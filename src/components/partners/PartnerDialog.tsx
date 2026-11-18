import type { IPartner, PartnerBody, PartnerTerms } from "@/api/partners";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PriceInput from "@/components/ui/PriceInput";
import Radio from "@/components/ui/Radio";
import { useLang } from "@/i18n/LanguageContext";
import { partnerRepository } from "@/repositories/PartnerRepository";
import { FormEvent, useState } from "react";
import { percentText } from "./partnerTerms";

interface Props {
  companyId: number;
  /** Absent: a new partner. */
  initial?: IPartner;
  onClose: () => void;
  onSaved: (p: IPartner) => void;
}

/** 0 to 100, at most two decimals; a comma reads as a point. */
const parsePercent = (raw: string): number | null => {
  const v = raw.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 100 ? n : null;
};

/**
 * Add or edit a partner (2026-11-18, owner): name, phone, comment, and the
 * terms in words: «Процент остаётся клубу» (10% of 100 000 → club 10 000,
 * partner 90 000) or «Партнёр платит клубу сумму в месяц». The body carries
 * ONLY the figure of the chosen terms, as the server requires; the split is
 * the server's to work out.
 */
const PartnerDialog = ({ companyId, initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [terms, setTerms] = useState<PartnerTerms>(initial?.terms ?? "percent");
  const [percent, setPercent] = useState(initial?.percent != null ? percentText(initial.percent) : "");
  const [fixed, setFixed] = useState(initial?.fixed_amount != null ? String(Number(initial.fixed_amount)) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim() === "") return setErr(t("partners.errors.name"));
    let body: PartnerBody;
    const base = { name: name.trim(), phone: phone.trim() || null, note: note.trim() || null };
    if (terms === "percent") {
      const p = parsePercent(percent);
      if (p === null) return setErr(t("partners.errors.percent"));
      body = { ...base, terms: "percent", percent: p };
    } else {
      const f = Number(fixed);
      if (fixed.trim() === "" || !Number.isFinite(f) || f < 0) return setErr(t("partners.errors.fixed"));
      body = { ...base, terms: "fixed", fixed_amount: f };
    }
    setBusy(true); setErr(null);
    try {
      const saved = initial ? await partnerRepository.update(initial.id, body) : await partnerRepository.create(companyId, body);
      onSaved(saved);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t("form.errors.failedSave"));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card partner-dialog" onSubmit={submit} data-testid="partner-dialog">
        <h2 style={{ margin: 0 }}>{t(initial ? "partners.titleEdit" : "partners.titleNew")}</h2>
        <Input label={t("partners.name")} value={name} onChange={(e) => { setName(e.target.value); setErr(null); }}
          maxLength={120} required requiredMark autoFocus disabled={busy} data-testid="partner-name" />
        <Input label={t("label.phone")} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          maxLength={32} disabled={busy} data-testid="partner-phone" />
        <label className="col" style={{ gap: 4 }}>
          <span className="label">{t("partners.note")}</span>
          <textarea className="input" value={note} maxLength={1000} rows={2} onChange={(e) => setNote(e.target.value)}
            disabled={busy} data-testid="partner-note" />
        </label>
        <div className="col" style={{ gap: 6 }}>
          <span className="label">{t("partners.terms")}</span>
          <div className="cp-choice-row partner-dialog__terms" role="radiogroup" aria-label={t("partners.terms")}>
            {(["percent", "fixed"] as const).map((k) => (
              <div key={k} className={`cp-choice${terms === k ? " is-active" : ""}`} data-testid={`partner-terms-${k}`}>
                <Radio
                  name="cp-partner-terms"
                  checked={terms === k}
                  onChange={() => { setTerms(k); setErr(null); }}
                  disabled={busy}
                  label={t(k === "percent" ? "partners.termsKindPercent" : "partners.termsKindFixed")}
                />
              </div>
            ))}
          </div>
        </div>
        {terms === "percent" ? (
          <div className="col" style={{ gap: 4 }}>
            <Input label={t("partners.percentLabel")} type="text" inputMode="decimal" value={percent}
              onChange={(e) => { setPercent(e.target.value); setErr(null); }} placeholder="10" disabled={busy} data-testid="partner-percent" />
            <span className="muted" style={{ fontSize: 12 }}>{t("partners.percentHint")}</span>
          </div>
        ) : (
          <div className="col" style={{ gap: 4 }} data-testid="partner-fixed">
            <PriceInput label={t("partners.fixedLabel")} value={fixed} onChange={(v) => { setFixed(v); setErr(null); }} disabled={busy} />
            <span className="muted" style={{ fontSize: 12 }}>{t("partners.fixedHint")}</span>
          </div>
        )}
        {err && <div className="error" role="alert">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy} data-testid="partner-save">{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default PartnerDialog;
