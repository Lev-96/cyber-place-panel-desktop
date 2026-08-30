import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import MultiLangInput, {
  LangValues,
  hasAnyValue,
  langValuesFromField,
  primaryValue,
} from "@/components/ui/MultiLangInput";
import PriceInput from "@/components/ui/PriceInput";
import { apiSaveEntityTranslations } from "@/api/translations";
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

/**
 * Product form with per-language name and category.
 *
 * Both text fields show all three languages, ordered with the interface
 * language first, and translate as the user types. The entity itself still
 * carries a single `name` / `category` column — the interface-language value —
 * so every existing consumer of `product.name` keeps working; the per-language
 * values go to the translations endpoint straight after the save.
 *
 * Two calls rather than one because that endpoint is identical for every
 * translatable entity: eight forms share it instead of eight controllers each
 * growing their own copy of the same write. If the second call fails the
 * product still exists with a valid name, and the background pipeline fills the
 * other languages — the same translations the form already primed into the
 * translation memory, so it costs nothing.
 */
const ProductForm = ({ branchId, initial, onClose, onSaved }: Props) => {
  const { t, lang } = useLang();
  const [name, setName] = useState<LangValues>(
    () => langValuesFromField(initial?.i18n, "name", initial?.name, lang),
  );
  const [category, setCategory] = useState<LangValues>(
    () => langValuesFromField(initial?.i18n, "category", initial?.category, lang),
  );
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pr = Number(price);
    if (!Number.isFinite(pr) || pr < 0) return setErr(t("product.errors.price"));
    if (!hasAnyValue(name)) return setErr(t("product.errors.name"));

    setBusy(true); setErr(null);
    try {
      const nameValue = primaryValue(name, lang);
      const categoryValue = primaryValue(category, lang);

      const p = initial
        ? await productRepository.update(initial.id, {
            name: nameValue,
            category: categoryValue || null,
            price: pr,
            source_locale: lang,
          })
        : await productRepository.create({
            branch_id: branchId,
            name: nameValue,
            category: categoryValue || null,
            price: pr,
            is_active: true,
            source_locale: lang,
          });

      await apiSaveEntityTranslations("product", p.id, {
        primary_locale: lang,
        fields: { name, category },
      });

      onSaved(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("form.errors.failedSave"));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 560, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 16 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{initial ? t("product.titleEdit") : t("product.titleNew")}</h2>

        <MultiLangInput
          label={t("label.name")}
          values={name}
          onChange={setName}
          fieldClass="product_name"
          maxChars={60}
          required
          autoFocus
          disabled={busy}
        />

        <MultiLangInput
          label={t("label.category")}
          values={category}
          onChange={setCategory}
          fieldClass="product_category"
          maxChars={40}
          disabled={busy}
        />

        <PriceInput label={t("label.price")} value={price} onChange={setPrice} required />

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
