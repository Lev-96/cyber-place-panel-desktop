import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import { SourceLocaleSelect, TranslationPreview } from "@/components/ui/TranslatedField";
import { useLang } from "@/i18n/LanguageContext";
import { Lang } from "@/i18n/translations";
import { productRepository } from "@/repositories/ProductRepository";
import { IProduct } from "@/types/pos";
import { FormEvent, useState } from "react";

interface Props {
  branchId: number;
  initial?: IProduct;
  onClose: () => void;
  onSaved: (p: IProduct) => void;
}

/**
 * Single-language product form.
 *
 * Staff fill in `name` and `category` ONCE, in whatever language they think in;
 * the backend translates them into the other UI locales in the background. The
 * only extra control is "which language am I typing in", defaulted to the
 * panel's language because that is right nearly every time.
 *
 * On edit the machine translations are shown read-only rather than as inputs:
 * hand-editing a locale permanently locks it out of the automatic pipeline, so
 * that belongs behind a deliberate action, not next to the field staff touch on
 * every price change.
 */
const ProductForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t, lang } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [sourceLocale, setSourceLocale] = useState<Lang>(initial?.source_locale ?? lang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pr = Number(price);
    if (!Number.isFinite(pr) || pr < 0) return setErr(t("product.errors.price"));
    setBusy(true); setErr(null);
    try {
      const p = initial
        ? await productRepository.update(initial.id, {
            name,
            category: category || null,
            price: pr,
            source_locale: sourceLocale,
          })
        : await productRepository.create({
            branch_id: branchId,
            name,
            category: category || null,
            price: pr,
            is_active: true,
            source_locale: sourceLocale,
          });
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
        <PriceInput label={t("label.price")} value={price} onChange={setPrice} required />
        <SourceLocaleSelect value={sourceLocale} onChange={setSourceLocale} disabled={busy} />
        {initial && (
          <TranslationPreview
            i18n={initial.i18n}
            field="name"
            sourceLocale={sourceLocale}
            status={initial.i18n_status?.name}
          />
        )}
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
