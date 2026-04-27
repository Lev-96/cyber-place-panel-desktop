import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { productRepository } from "@/repositories/ProductRepository";
import { IProduct } from "@/types/pos";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  initial?: IProduct;
  onClose: () => void;
  onSaved: (p: IProduct) => void;
}

const ProductForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pr = Number(price);
    if (!Number.isFinite(pr) || pr < 0) return setErr("Price must be a non-negative number");
    setBusy(true); setErr(null);
    try {
      const p = initial
        ? await productRepository.update(initial.id, { name, category: category || null, price: pr })
        : await productRepository.create({ branch_id: branchId, name, category: category || null, price: pr, is_active: true });
      onSaved(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally { setBusy(false); }
  };

  return (
    <div style={overlay}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? "Edit product" : "New product"}</h2>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input label="Category (optional)" value={category ?? ""} onChange={(e) => setCategory(e.target.value)} />
        <Input label="Price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
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

export default ProductForm;
