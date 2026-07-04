import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { memberRepository } from "@/repositories/MemberRepository";
import { IMember } from "@/types/members";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  initial?: IMember;
  onClose: () => void;
  onSaved: (m: IMember) => void;
}

const MemberForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [card, setCard] = useState(initial?.card_code ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Phone is optional, but if entered it must be a real number. Default to the
  // product's primary market (Armenia) so local numbers validate without the
  // dial prefix; an explicit "+<code>…" still parses as international.
  const phoneParsed = phone.trim()
    ? parsePhoneNumberFromString(phone, "AM")
    : undefined;
  const phoneValid = !phone.trim() || (!!phoneParsed && phoneParsed.isValid());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phoneValid) { setErr(t("branchForm.invalidPhone")); return; }
    const normalizedPhone = phoneParsed ? phoneParsed.formatInternational() : null;
    setBusy(true); setErr(null);
    try {
      const m = initial
        ? await memberRepository.update(initial.id, { name, phone: normalizedPhone, email: email || null, card_code: card || null })
        : await memberRepository.create({ branch_id: branchId, name, phone: normalizedPhone, email: email || null, card_code: card || null });
      onSaved(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("form.errors.failed"));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("member.titleEdit") : t("member.titleNew")}</h2>
        <Input label={t("label.name")} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div>
          <Input label={t("label.phone")} type="tel" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
          {phone.trim() !== "" && !phoneValid && (
            <span className="muted" style={{ fontSize: 11, color: "#ef4444" }}>{t("branchForm.invalidPhone")}</span>
          )}
        </div>
        <Input label={t("label.email")} type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
        <Input label={t("label.cardCode")} value={card ?? ""} onChange={(e) => setCard(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default MemberForm;
