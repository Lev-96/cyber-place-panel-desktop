import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
import { memberRepository } from "@/repositories/MemberRepository";
import { IMember } from "@/types/members";
import { FormEvent, useState } from "react";

interface Props {
  member: IMember;
  onClose: () => void;
  onDone: (m: IMember) => void;
}

const TopupDialog = ({ member, onClose, onDone }: Props) => {
  const { t, money } = useLang();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setErr(t("topup.errors.amount"));
    setBusy(true); setErr(null);
    try {
      const res = await memberRepository.topup(member.id, n, reference || undefined);
      onDone(res.member);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("form.errors.failed"));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 380, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{t("topup.title")} · {member.name}</h2>
        <div className="muted">{t("topup.balance")}: <b style={{ color: "#fff" }}>{money(Number(member.balance))}</b></div>
        <Input label={t("label.amount")} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        <Input label={t("label.reference")} value={reference} onChange={(e) => setReference(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? t("topup.processing") : t("topup.title")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default TopupDialog;
