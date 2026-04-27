import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { memberRepository } from "@/repositories/MemberRepository";
import { IMember } from "@/types/members";
import { FormEvent, useState } from "react";

interface Props {
  member: IMember;
  onClose: () => void;
  onDone: (m: IMember) => void;
}

const TopupDialog = ({ member, onClose, onDone }: Props) => {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setErr("Amount must be > 0");
    setBusy(true); setErr(null);
    try {
      const res = await memberRepository.topup(member.id, n, reference || undefined);
      onDone(res.member);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div style={overlay}>
      <form className="card" style={{ width: 380, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>Top up · {member.name}</h2>
        <div className="muted">Current balance: <b style={{ color: "#fff" }}>{Number(member.balance).toFixed(2)}</b></div>
        <Input label="Amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        <Input label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy}>{busy ? "Processing…" : "Top up"}</Button>
        </div>
      </form>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(2,5,20,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
};

export default TopupDialog;
