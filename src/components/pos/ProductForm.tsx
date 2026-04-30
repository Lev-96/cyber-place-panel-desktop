import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useLang } from "@/i18n/LanguageContext";
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
  const { t } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pr = Number(price);
    if (!Number.isFinite(pr) || pr < 0) return setErr(t("product.errors.price"));
    setBusy(true); setErr(null);
    try {
      const p = initial
        ? await productRepository.update(initial.id, { name, category: category || null, price: pr })
        : await productRepository.create({ branch_id: branchId, name, category: category || null, price: pr, is_active: true });
      onSaved(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("form.errors.failedSave"));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 420, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("product.titleEdit") : t("product.titleNew")}</h2>
        <Input label={t("label.name")} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input label={t("label.category")} value={category ?? ""} onChange={(e) => setCategory(e.target.value)} />
        <Input label={t("label.price")} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ProductForm;
