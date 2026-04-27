import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { memberRepository } from "@/repositories/MemberRepository";
import { IMember } from "@/types/members";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  initial?: IMember;
  onClose: () => void;
  onSaved: (m: IMember) => void;
}

const MemberForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [card, setCard] = useState(initial?.card_code ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const m = initial
        ? await memberRepository.update(initial.id, { name, phone: phone || null, email: email || null, card_code: card || null })
        : await memberRepository.create({ branch_id: branchId, name, phone: phone || null, email: email || null, card_code: card || null });
      onSaved(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div style={overlay}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? "Edit member" : "New member"}</h2>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input label="Phone" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Email" type="email" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Card code" value={card ?? ""} onChange={(e) => setCard(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(2,5,20,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
};

export default MemberForm;
