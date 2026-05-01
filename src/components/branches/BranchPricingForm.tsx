import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { branchRepository } from "@/repositories/BranchRepository";
import { IBranchApi } from "@/types/api";
import { FormEvent, useState } from "react";

type PriceKey = "pc-standard" | "pc-vip" | "ps4-standard" | "ps4-vip" | "ps5-standard" | "ps5-vip";

interface Props {
  branch: IBranchApi;
  onClose: () => void;
  onSaved: () => void;
}

const KEYS: PriceKey[] = ["pc-standard", "pc-vip", "ps4-standard", "ps4-vip", "ps5-standard", "ps5-vip"];

const BranchPricingForm = ({ branch, onClose, onSaved }: Props) => {
  const [prices, setPrices] = useState<Record<PriceKey, string>>(() => {
    const init = {} as Record<PriceKey, string>;
    for (const k of KEYS) init[k] = String(branch.price_for_branch?.[k] ?? "");
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      // Backend expects the full pricing row including its surrogate id (0
      // for "no row yet — create one"). Build it as the same shape the API
      // helper accepts so we don't have to bypass the type system.
      type Pricing = NonNullable<IBranchApi["price_for_branch"]>;
      const payload = { id: branch.price_for_branch?.id ?? 0, branch_id: branch.id } as Pricing;
      for (const k of KEYS) {
        const v = prices[k].trim();
        payload[k] = v ? Number(v) : null;
      }
      await branchRepository.updatePricing(branch.id, payload);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 480, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>Pricing · {branch.address}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 10, alignItems: "center" }}>
          <span />
          <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>Standard</span>
          <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>VIP</span>
          {["pc", "ps4", "ps5"].map((dev) => (
            <PriceRow key={dev} device={dev} prices={prices} setPrices={setPrices} />
          ))}
        </div>
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
};

const PriceRow = ({ device, prices, setPrices }: { device: string; prices: Record<PriceKey, string>; setPrices: (s: Record<PriceKey, string>) => void }) => {
  const stdKey = `${device}-standard` as PriceKey;
  const vipKey = `${device}-vip` as PriceKey;
  return (
    <>
      <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{device}</span>
      <input className="input" type="number" min={0} step="0.01" value={prices[stdKey]} onChange={(e) => setPrices({ ...prices, [stdKey]: e.target.value })} />
      <input className="input" type="number" min={0} step="0.01" value={prices[vipKey]} onChange={(e) => setPrices({ ...prices, [vipKey]: e.target.value })} />
    </>
  );
};

export default BranchPricingForm;
