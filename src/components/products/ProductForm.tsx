import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import MultiLangInput, {
  LangValues,
  hasAnyValue,
  langValuesFromField,
  primaryValue,
} from "@/components/ui/MultiLangInput";
import PriceInput from "@/components/ui/PriceInput";
import Radio from "@/components/ui/Radio";
import { apiSaveEntityTranslations } from "@/api/translations";
import { CreateProductBody, IProductExistsBody, productExistsBody, StockChoice } from "@/api/products";
import type { IPartner } from "@/api/partners";
import Switch from "@/components/ui/Switch";
import { tr } from "@/i18n/translated";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { productRepository } from "@/repositories/ProductRepository";
import { AdditionalPricingMode, IProduct, isAdditionalProduct, ProductKind } from "@/types/pos";
import { notify } from "@/ui/notify";
import { newRequestId } from "@/utils/requestId";
import { FormEvent, useRef, useState } from "react";
import ProductMergePanel from "./ProductMergePanel";
import { parseQuantity, stockChangeText, stockNumber } from "./stock";
import { partnerChoices } from "@/components/partners/partnerTerms";

interface Props {
  branchId: number;
  initial?: IProduct;
  /**
   * What a NEW entry is — the section it is created from (Products, or
   * Additional items). An edit keeps the entry's own kind.
   */
  kind?: ProductKind;
  /** A NEW product starts as fast food (created from the «Быстрая Еда» tab). */
  fastFood?: boolean;
  /**
   * The company's partners, for whoever may choose whose fast food a product
   * is (`partners.manage`, 2026-11-18). Absent: no partner field at all and
   * `partner_id` is never sent (a manager, or a dialog that has no list).
   */
  partners?: readonly IPartner[] | null;
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
 *
 * ## «Количество» (2026-11-16)
 * A NEW product sold by the unit may come with how many are on the shelf.
 * Empty = not counted, and the create is the one it always was. With a number
 * the server matches the name: a product of that name at the same price gets
 * the quantity added («Кола» 5 + 10 = 15, no second «Кола»), and its own names
 * are left as they are (nothing is translated over them); another price, or
 * several of that name, comes back as a question ({@see ProductMergePanel}).
 * One press is one receipt: the request id lives as long as the form.
 */
const ProductForm = ({ branchId, initial, onClose, onSaved, kind: kindProp = "regular", fastFood: fastFoodProp = false, partners }: Props) => {
  const { t, lang } = useLang();
  const [name, setName] = useState<LangValues>(
    () => langValuesFromField(initial?.i18n, "name", initial?.name, lang),
  );
  const [category, setCategory] = useState<LangValues>(
    () => langValuesFromField(initial?.i18n, "category", initial?.category, lang),
  );
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const kind: ProductKind = initial ? (isAdditionalProduct(initial) ? "additional" : "regular") : kindProp;
  /** Only a new product sold by the unit may arrive with a quantity. */
  const asksQuantity = !initial && kind === "regular";
  const [quantity, setQuantity] = useState("");
  /**
   * An additional item's price: added once, or a rate added to every hour it
   * is out — the joysticks' «Фиксированная цена» / «Изменение тарифа»
   * (2026-11-17). Opens on what the item carries; null (every item before the
   * choice) is fixed.
   */
  const [pricingMode, setPricingMode] = useState<AdditionalPricingMode>(
    initial?.pricing_mode === "hourly" ? "hourly" : "fixed",
  );
  /** Sent for an additional item only: a regular product has no rate to change. */
  const pricingBody = kind === "additional" ? { pricing_mode: pricingMode } : {};
  /**
   * «Быстрая Еда» (2026-11-18): a regular product only. A partner's product
   * stays fast food until its partner is removed, which only someone with
   * the partner list may do: for anyone else the switch is locked on.
   */
  /** What the server holds now: a new product is not fast food until the save says so. */
  const storedFastFood = initial?.is_fast_food === true;
  const initialPartner = initial?.partner_id ?? null;
  const [fastFood, setFastFood] = useState(initial ? storedFastFood : fastFoodProp);
  const [partnerId, setPartnerId] = useState<number | null>(initialPartner);
  const managesPartners = partners !== undefined && partners !== null;
  const fastFoodLocked = !managesPartners && initialPartner !== null;
  /** Whose it is once saved: no partner without fast food. */
  const effectivePartner = fastFood ? partnerId : null;
  /** The pickable partners, plus the product's own one if it was archived meanwhile. */
  const choices = managesPartners ? partnerChoices(partners, initialPartner) : [];
  /**
   * The fast-food keys of a save: only what changed (a create: only when on),
   * so a product saved without touching them is the request it always was.
   * `partner_id` only for someone who manages partners.
   */
  const fastFoodBody: Pick<CreateProductBody, "is_fast_food" | "partner_id"> = kind !== "regular" ? {} : {
    ...(fastFood !== storedFastFood ? { is_fast_food: fastFood } : {}),
    ...(managesPartners && effectivePartner !== initialPartner ? { partner_id: effectivePartner } : {}),
  };
  const [exists, setExists] = useState<IProductExistsBody | null>(null);
  const requestId = useRef(newRequestId());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const locked = busy || exists !== null;

  const saveTranslations = (id: number) =>
    apiSaveEntityTranslations("product", id, { primary_locale: lang, fields: { name, category } });

  /** A new product WITH a quantity: created counted, added to the one of that name, or asked. */
  const createCounted = async (qty: number, answer?: { choice: StockChoice; id: number }) => {
    setBusy(true); setErr(null);
    try {
      const r = await productRepository.createCounted({
        branch_id: branchId,
        name: primaryValue(name, lang),
        category: primaryValue(category, lang) || null,
        price: Number(price),
        is_active: true,
        kind,
        source_locale: lang,
        stock: qty,
        client_request_id: requestId.current,
        ...fastFoodBody,
        ...(answer ? { on_existing: answer.choice, existing_id: answer.id } : {}),
      });
      if (r.merged && r.stock_change) {
        notify.message("success", fmt(t("product.mergedToast"), tr(r.product, "name", lang), stockChangeText(r.stock_change, t("stock.notCounted"))));
      } else {
        await saveTranslations(r.product.id);
        notify.message("success", typeof r.product.stock === "number"
          ? fmt(t("product.createdCounted"), stockNumber(r.product.stock))
          : t("toast.product.created"));
      }
      onSaved(r.product);
    } catch (e) {
      const asked = productExistsBody(e);
      if (asked !== null) {
        setExists(asked);
      } else {
        setErr(e instanceof Error ? e.message : t("form.errors.failedSave"));
      }
    } finally { setBusy(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const pr = Number(price);
    if (!Number.isFinite(pr) || pr < 0) return setErr(t("product.errors.price"));
    if (!hasAnyValue(name)) return setErr(t("product.errors.name"));
    const qty = asksQuantity ? parseQuantity(quantity) : ({ kind: "empty" } as const);
    if (qty.kind === "invalid") return setErr(t("product.errors.quantity"));
    if (qty.kind === "ok") return createCounted(qty.value);

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
            ...pricingBody,
            ...fastFoodBody,
          }, kind)
        : await productRepository.create({
            branch_id: branchId,
            name: nameValue,
            category: categoryValue || null,
            price: pr,
            is_active: true,
            kind,
            source_locale: lang,
            ...pricingBody,
            ...fastFoodBody,
          });

      await saveTranslations(p.id);

      onSaved(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("form.errors.failedSave"));
    } finally { setBusy(false); }
  };

  /**
   * The cashier's answer to the question. Saved, the parent closes the form;
   * asked again (the catalogue moved meanwhile), the panel shows the new
   * matches; refused, the panel stays with the reason under it.
   */
  const answer = (choice: StockChoice, id: number) => {
    const qty = parseQuantity(quantity);
    if (qty.kind === "ok") void createCounted(qty.value, { choice, id });
  };

  return (
    <Modal open onClose={onClose}>
      <form className="card" style={{ width: 560, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 16 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>
          {kind === "additional"
            ? t(initial ? "product.titleEditAdditional" : "product.titleNewAdditional")
            : t(initial ? "product.titleEdit" : "product.titleNew")}
        </h2>

        <MultiLangInput
          label={t("label.name")}
          values={name}
          onChange={setName}
          fieldClass="product_name"
          maxChars={60}
          required
          autoFocus
          disabled={locked}
        />

        <MultiLangInput
          label={t("label.category")}
          values={category}
          onChange={setCategory}
          fieldClass="product_category"
          maxChars={40}
          disabled={locked}
        />

        <PriceInput label={t("label.price")} value={price} onChange={setPrice} required disabled={locked} />

        {/* The joysticks' two answers, in their words (2026-11-17): the price
            is added once, or it changes the seat's hourly rate while the item
            is out. The sentence under it says which, with the item's name. */}
        {kind === "additional" && (
          <div className="col" style={{ gap: 6 }}>
            <span className="label">{t("product.pricingMode")}</span>
            <div className="cp-choice-row" role="radiogroup" aria-label={t("product.pricingMode")}>
              {(["fixed", "hourly"] as const).map((m) => (
                <div key={m} className={`cp-choice${pricingMode === m ? " is-active" : ""}`}>
                  <Radio
                    name="cp-product-pricing-mode"
                    checked={pricingMode === m}
                    onChange={() => setPricingMode(m)}
                    disabled={locked}
                    label={t(`joystickPrice.strategy.${m}`)}
                  />
                </div>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 12 }} data-testid="product-pricing-note">
              {fmt(
                t(pricingMode === "hourly" ? "place.extraItemHourlyNote" : "place.extraItemFixedNote"),
                primaryValue(name, lang) || t("branchExtraItem.itemFallback"),
              )}
            </span>
          </div>
        )}

        {kind === "regular" && (
          <div className="col" style={{ gap: 6 }} data-testid="product-fast-food">
            <Switch
              checked={fastFood}
              onChange={setFastFood}
              disabled={locked || fastFoodLocked}
              label={t("product.fastFood")}
              testId="product-fast-food-switch"
            />
            <span className="muted" style={{ fontSize: 12 }}>
              {t(fastFoodLocked ? "product.fastFoodLocked" : "product.fastFoodHint")}
            </span>
            {fastFood && managesPartners && (
              <label className="col" style={{ gap: 4 }}>
                <span className="label">{t("product.partner")}</span>
                <select
                  className="input"
                  value={partnerId ?? ""}
                  onChange={(e) => setPartnerId(e.target.value === "" ? null : Number(e.target.value))}
                  disabled={locked}
                  data-testid="product-partner"
                >
                  <option value="">{t("product.partnerOwn")}</option>
                  {choices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.archived ? fmt(t("product.partnerArchived"), p.name) : p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {asksQuantity && (
          <div className="col" style={{ gap: 4 }}>
            <Input
              label={t("product.quantity")}
              type="text"
              inputMode="numeric"
              value={quantity}
              onChange={(ev) => { setQuantity(ev.target.value); setErr(null); }}
              placeholder={t("stock.notCounted")}
              disabled={locked}
              data-testid="product-quantity"
            />
            <span className="muted" style={{ fontSize: 12 }}>{t("product.quantityHint")}</span>
          </div>
        )}

        {exists !== null && (
          <ProductMergePanel exists={exists} typedPrice={Number(price)} busy={busy} onChoose={answer} onBack={() => setExists(null)} />
        )}

        {err && <div className="error">{err}</div>}
        {exists === null && (
          <div className="row-between">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
            <Button disabled={busy}>{busy ? "…" : t("action.save")}</Button>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default ProductForm;
