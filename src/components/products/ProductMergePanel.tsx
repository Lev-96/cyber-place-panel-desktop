import Button from "@/components/ui/Button";
import ChoiceCards from "@/components/ui/ChoiceCards";
import { IProductExistsBody, StockChoice } from "@/api/products";
import { tr } from "@/i18n/translated";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { stockNumber } from "./stock";

interface Props {
  /** The server's 409: the products the typed name already means. */
  exists: IProductExistsBody;
  /** The price typed in the form (AMD), offered as the new price. */
  typedPrice: number;
  busy: boolean;
  onChoose: (choice: StockChoice, productId: number) => void;
  onBack: () => void;
}

/**
 * «Такой товар уже есть» (2026-11-16): the name the cashier typed is already
 * in the catalogue at another price, or more than once. Nothing was written;
 * the quantity goes to the product they pick here — «Добавить к остатку»
 * keeps its price, «Добавить и сменить цену» moves it to the one typed. One
 * match is picked already; several ask which.
 */
const ProductMergePanel = ({ exists, typedPrice, busy, onChoose, onBack }: Props) => {
  const { t, money, lang } = useLang();
  const ref = useRef<HTMLElement>(null);
  // The question opens under the fields: brought into view, so a short window
  // shows it and its buttons, not the name typed above.
  useEffect(() => { ref.current?.scrollIntoView?.({ block: "nearest" }); }, []);
  const [picked, setPicked] = useState<number | null>(exists.matches.length === 1 ? exists.matches[0].id : null);
  const chosen = exists.matches.find((m) => m.id === picked) ?? null;
  // A new price is only offered when it IS new.
  const priceDiffers = chosen !== null && Number(chosen.price) !== typedPrice;

  return (
    <section ref={ref} className="product-merge" aria-label={t("product.exists.title")} data-testid="product-merge">
      <strong className="product-merge__title">{t("product.exists.title")}</strong>
      <span className="muted product-merge__hint">{t("product.exists.hint")}</span>
      <ChoiceCards
        label={t("product.exists.pick")}
        name="product-merge"
        value={picked}
        onChange={setPicked}
        disabled={busy}
        testId="product-merge-choice"
        choices={exists.matches.map((m) => ({
          key: m.id,
          title: tr({ name: m.name, i18n: m.i18n }, "name", lang) || m.name,
          detail: `${fmt(t("product.exists.price"), money(Number(m.price)))} · ${m.stock === null ? t("stock.notCounted") : fmt(t("stock.left"), stockNumber(m.stock))}`,
          badge: m.is_active ? undefined : t("product.exists.hidden"),
        }))}
      />
      <div className="product-merge__actions">
        <Button type="button" variant="secondary" onClick={onBack} disabled={busy}>{t("action.back")}</Button>
        {priceDiffers && (
          <Button type="button" variant="secondary" onClick={() => chosen && onChoose("add_and_reprice", chosen.id)} disabled={busy} data-testid="product-merge-reprice">
            {fmt(t("product.exists.addReprice"), money(typedPrice))}
          </Button>
        )}
        <Button type="button" onClick={() => chosen && onChoose("add", chosen.id)} disabled={busy || chosen === null} data-testid="product-merge-add">
          {t("product.exists.add")}
        </Button>
      </div>
    </section>
  );
};

export default ProductMergePanel;
