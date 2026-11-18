import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { renderText } from "@/i18n/localizedText";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import type { IAcceptanceProduct } from "@/types/shifts";
import { memo, useMemo, useState } from "react";
import { type CountValues, SEARCH_FROM, filterProducts, isInvalidCount, uncountedIds } from "./acceptanceCount";
import type { AcceptanceStep } from "./useShiftOpening";

/**
 * «Приём смены» (2026-11-18): the manager coming on counts every product with
 * stock, BLIND — the screen never shows what the books expect. One box per
 * product, «Сколько есть сейчас»: empty = not counted yet, 0 is a count.
 * Open stays off until every product has a number; a search box from
 * {@link SEARCH_FROM} products on (hidden ones keep their numbers and still
 * count towards «Посчитано: N из M»). Products the server said were missed
 * are outlined red until counted.
 */
interface Props {
  step: AcceptanceStep;
  values: CountValues;
  busy: boolean;
  onChange: (productId: number, raw: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const ShiftAcceptanceDialog = ({ step, values, busy, onChange, onConfirm, onCancel }: Props) => {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterProducts(step.products, query), [step.products, query]);
  const left = uncountedIds(step.products, values).length;
  const total = step.products.length;
  const missing = useMemo(() => new Set(step.missingIds), [step.missingIds]);

  return (
    <Modal open onClose={busy ? () => undefined : onCancel} confirmOnDirty={false}>
      <div className="card shift-accept" data-testid="shift-accept">
        <h2 className="shift-accept__title">{t("shift.accept.title")}</h2>
        <p className="shift-accept__hint">{t("shift.accept.hint")}</p>

        {total >= SEARCH_FROM && (
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("shift.accept.search")}
            aria-label={t("shift.accept.search")}
            data-testid="shift-accept-search"
          />
        )}

        <div className="shift-accept__progress" role="status" data-testid="shift-accept-progress">
          {fmt(t("shift.accept.progress"), total - left, total)}
        </div>

        {step.error && (
          <div className="error shift-accept__error" role="alert" data-testid="shift-accept-error">
            {renderText(step.error, t)}
          </div>
        )}

        <ul className="shift-accept__list" data-testid="shift-accept-list">
          {shown.map((p) => (
            <AcceptanceRow
              key={p.product_id}
              product={p}
              value={values[p.product_id] ?? ""}
              highlighted={missing.has(p.product_id) && (values[p.product_id] ?? "").trim() === ""}
              disabled={busy}
              onChange={onChange}
            />
          ))}
          {shown.length === 0 && <li className="muted">{t("shift.accept.noMatch")}</li>}
        </ul>

        <div className="shift-accept__actions">
          {left > 0 && <span className="muted shift-accept__left" data-testid="shift-accept-left">{fmt(t("shift.accept.left"), left)}</span>}
          <div className="shift-accept__buttons">
            <Button variant="secondary" onClick={onCancel} disabled={busy}>{t("action.cancel")}</Button>
            <Button onClick={onConfirm} disabled={busy || left > 0} data-testid="shift-accept-open">
              {busy ? t("shift.opening") : t("shift.open")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

/** One product: its name (and «скрыт» when hidden from sale) and its count box. Memoised: a keystroke redraws one row. */
const AcceptanceRow = memo(({ product, value, highlighted, disabled, onChange }: {
  product: IAcceptanceProduct;
  value: string;
  highlighted: boolean;
  disabled: boolean;
  onChange: (productId: number, raw: string) => void;
}) => {
  const { t } = useLang();
  const invalid = isInvalidCount(value);
  const id = `shift-accept-${product.product_id}`;
  return (
    <li
      className={`shift-accept__row${highlighted ? " is-missing" : ""}`}
      data-testid="shift-accept-row"
      data-product-id={product.product_id}
    >
      <label className="shift-accept__name" htmlFor={id}>
        <span>{product.name}</span>
        {(product.category || !product.is_active) && (
          <span className="muted shift-accept__meta">
            {[product.category, product.is_active ? null : t("product.exists.hidden")].filter(Boolean).join(" · ")}
          </span>
        )}
      </label>
      <div className="shift-accept__field">
        <span className="label">{t("shift.accept.countLabel")}</span>
        <input
          id={id}
          className={`input${invalid || highlighted ? " is-invalid" : ""}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          disabled={disabled}
          aria-invalid={invalid || highlighted}
          onChange={(e) => onChange(product.product_id, e.target.value)}
          data-testid="shift-accept-input"
        />
        {invalid && <span className="error shift-accept__invalid">{t("shift.accept.invalid")}</span>}
      </div>
    </li>
  );
});
AcceptanceRow.displayName = "AcceptanceRow";

export default ShiftAcceptanceDialog;
