import { ListSkeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Radio from "@/components/ui/Radio";
import OptionList from "@/components/ui/OptionList";
import ProductForm from "@/components/products/ProductForm";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { ProductBasket } from "./useProductBasket";
import { choiceKey } from "./quickEntryChoices";
import type { IResolvedItemLine } from "@/api/sessions";
import { RefObject, useCallback, useEffect, useRef } from "react";

/**
 * The parts of a sale dialog that do not care what the sale is for — the
 * session's bill or the till (2026-09-24). Moved verbatim from the session's
 * AddSessionItemDialog, labels and aria names included, so the two dialogs
 * read and behave as one.
 */

interface ModeSwitchProps {
  basket: ProductBasket;
  /** The radio group's name — unique per dialog. */
  name: string;
  disabled: boolean;
}

/**
 * Two ways in, and the one that has always been here is the one the dialog
 * opens on. A radiogroup rather than a tab strip because it is a choice about
 * how to work, not a place to navigate to — and the picker's own state
 * survives the trip.
 */
export const BasketModeSwitch = ({ basket, name, disabled }: ModeSwitchProps) => {
  const { t } = useLang();
  return (
    <div className="row" role="radiogroup" aria-label={t("session.addMode")} style={{ gap: 16, flexWrap: "wrap" }}>
      <Radio
        name={name}
        checked={basket.mode === "picker"}
        onChange={() => basket.setMode("picker")}
        disabled={disabled}
        label={t("session.addModePicker")}
      />
      <Radio
        name={name}
        checked={basket.mode === "text"}
        onChange={() => basket.setMode("text")}
        disabled={disabled}
        label={t("session.addModeText")}
      />
    </div>
  );
};

interface PickerProps {
  basket: ProductBasket;
  saving: boolean;
  /** Mirrors the backend's `products.manage`: owner-level, never a manager. */
  canCreateProducts: boolean;
}

/** The branch catalogue, the basket, and "a product the branch does not stock yet". */
export const BasketPicker = ({ basket, saving, canCreateProducts }: PickerProps) => {
  const { money, t } = useLang();
  const { products, filtered, cart, cartTotal } = basket;

  return (
    <>
      {/* ── The branch catalogue ─────────────────────────────────────── */}
      <span className="label" style={{ fontSize: 12 }}>{t("session.availableProducts")}</span>
      {(products?.length ?? 0) > 0 && (
        <Input placeholder={t("session.search")} value={basket.search} onChange={(e) => basket.setSearch(e.target.value)} />
      )}

      {basket.loading ? <ListSkeleton rows={3} /> : (
        <div className="col" style={{ gap: 6, maxHeight: 190, overflowY: "auto" }}>
          {products?.length === 0 && (
            <div className="muted" style={{ fontSize: 13 }}>{t("session.noProducts")}</div>
          )}
          {products?.length !== 0 && filtered.length === 0 && (
            <div className="muted" style={{ fontSize: 13 }}>{t("session.noSearchMatches")}</div>
          )}
          {filtered.map((p) => (
            <div key={p.id} style={rowStyle}>
              <span style={ellipsis} title={p.name}>{p.name}</span>
              <span className="muted" style={{ fontSize: 11 }}>{p.category || t("session.products")}</span>
              <span style={{ fontWeight: 700, minWidth: 80, textAlign: "right" }}>{money(Number(p.price))}</span>
              <Button
                onClick={() => basket.put({ key: `p:${p.id}`, product_id: p.id, name: p.name, price: Number(p.price) })}
                disabled={saving}
                style={plusBtn}
                // Named per product: a column of identical "Add" buttons is
                // unreadable to a screen reader, and to a test.
                aria-label={`${t("action.add")}: ${p.name}`}
              >
                +
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── The basket ───────────────────────────────────────────────── */}
      <div className="col" style={{ gap: 8, borderTop: "1px solid #1f2a44", paddingTop: 12 }}>
        <div className="row-between">
          <span className="label" style={{ fontSize: 12 }}>{t("session.addedProducts")}</span>
          {cart.length > 0 && (
            <span className="muted" style={{ fontSize: 12 }}>
              {t("session.itemsTotal")}: <b>{money(cartTotal)}</b>
            </span>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>{t("session.cartEmpty")}</div>
        ) : (
          <div className="col" style={{ gap: 6, maxHeight: 190, overflowY: "auto" }}>
            {cart.map((line) => (
              <div key={line.key} style={rowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={ellipsis} title={line.name}>{line.name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {money(line.price)} · {money(line.price * line.qty)}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => basket.step(line.key, -1)}
                  disabled={saving}
                  style={stepBtn}
                  aria-label={t("session.decrease")}
                  title={t("session.decrease")}
                >
                  −
                </Button>
                <span style={{ minWidth: 28, textAlign: "center", fontWeight: 700 }}>{line.qty}</span>
                <Button
                  variant="secondary"
                  onClick={() => basket.step(line.key, 1)}
                  disabled={saving}
                  style={stepBtn}
                  aria-label={t("session.increase")}
                  title={t("session.increase")}
                >
                  +
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => basket.drop(line.key)}
                  disabled={saving}
                  style={{ ...stepBtn, color: "#ef4444", borderColor: "#4a1a1a" }}
                  title={t("action.delete")}
                >
                  {t("action.delete")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Something the branch does not stock yet ──────────────────────
          Owner-level, and only shown to one. A manager sells from the
          catalogue; writing it is the company's, which is what the backend
          has always answered (`products.manage` → 403). */}
      {canCreateProducts && (
        <div className="col" style={{ gap: 8, borderTop: "1px solid #1f2a44", paddingTop: 12 }}>
          <div className="row-between" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>{t("session.createProductHint")}</span>
            <Button variant="secondary" onClick={() => basket.setCreating(true)} disabled={saving}>
              {t("session.createProduct")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

interface QuickEntryProps {
  basket: ProductBasket;
  saving: boolean;
  /**
   * The dialog's own add/sell button. Once the last ambiguous line is answered
   * the focus goes there, so the next Enter presses THAT button — through its
   * own guarded handler; this panel never submits anything itself.
   */
  confirmRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * One line per product, the number at either end. Nothing is sold until the
 * cashier presses the confirm below: what this shows is the server's reading
 * of the text, priced from the catalogue.
 */
export const BasketQuickEntry = ({ basket, saving, confirmRef }: QuickEntryProps) => {
  const { money, t } = useLang();
  const { resolved, resolving } = basket;
  const textRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  /** Each ambiguous line's option list, by line index. */
  const pickLists = useRef(new Map<number, HTMLDivElement>());
  /** A pick is waiting for the server's answer before the focus moves on. */
  const advanceRef = useRef(false);

  /**
   * After a pick made with Enter: the next line still waiting for one, else
   * the dialog's button when the whole box reads clean. Only while the focus
   * is still in the preview — an operator who went back to typing keeps their
   * caret. A click leaves the focus on its list: the mouse goes to the button
   * itself, and the arrows keep working where the operator is.
   */
  const advance = useCallback(() => {
    if (!previewRef.current?.contains(document.activeElement)) return;
    const waiting = (resolved?.lines ?? []).findIndex((l) => l.status === "ambiguous");
    if (waiting >= 0) pickLists.current.get(waiting)?.focus();
    else if (resolved?.ok) confirmRef?.current?.focus();
  }, [resolved, confirmRef]);

  useEffect(() => {
    if (!advanceRef.current || resolving) return;
    advanceRef.current = false;
    advance();
  }, [resolving, advance]);

  const pick = (index: number, raw: string, productId: number, answered: boolean, byKeyboard: boolean) => {
    basket.choose(index, raw, productId);
    if (!byKeyboard) return;
    // The same product again asks the server nothing: move on at once.
    if (answered) advance();
    else advanceRef.current = true;
  };

  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="label" style={{ fontSize: 12 }}>{t("session.quickEntry")}</span>
      <textarea
        ref={textRef}
        className="input"
        rows={5}
        value={basket.text}
        onChange={(e) => basket.setText(e.target.value)}
        disabled={saving}
        placeholder={t("session.quickEntryPlaceholder")}
        aria-label={t("session.quickEntry")}
        style={{ resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
      />
      <span className="muted" style={{ fontSize: 11 }}>{t("session.quickEntryHint")}</span>

      {basket.resolving && (
        <span className="muted" style={{ fontSize: 11 }}>{t("session.quickEntryReading")}</span>
      )}

      {resolved !== null && resolved.lines.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <span className="label" style={{ fontSize: 12 }}>{t("session.quickEntryPreview")}</span>
          <div ref={previewRef} className="col" style={{ gap: 6, maxHeight: 220, overflowY: "auto" }}>
            {resolved.lines.map((line, i) => (
              <div key={`${line.raw}-${i}`} className="col" style={{ gap: 2 }}>
                {(line.options?.length ?? 0) > 0 ? (
                  <QuickEntryPick
                    line={line}
                    index={i}
                    picked={basket.choices[choiceKey(i, line.raw)] ?? (line.status === "matched" ? line.product_id : null)}
                    saving={saving}
                    onPick={pick}
                    onEscape={() => textRef.current?.focus()}
                    listRef={(el) => {
                      if (el) pickLists.current.set(i, el);
                      else pickLists.current.delete(i);
                    }}
                  />
                ) : line.error === null ? (
                  <div className="row-between" style={{ gap: 8 }}>
                    <span>{line.name} × {line.qty}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {money(line.price ?? 0)} · {money(line.line_total ?? 0)}
                    </span>
                  </div>
                ) : (
                  <div className="col" style={{ gap: 2 }}>
                    <span className="error" style={{ fontSize: 12 }}>
                      {fmt(t("session.quickEntryLine"), line.raw)} {line.error}
                    </span>
                    {line.candidates.length > 0 && (
                      <span className="muted" style={{ fontSize: 11 }}>
                        {fmt(t("session.quickEntryCandidates"), line.candidates.join(", "))}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {basket.pendingPicks > 0 && (
            <span className="quick-pick__pending" role="status">
              {fmt(t("session.quickEntryPickPending"), basket.pendingPicks)}
            </span>
          )}
          {resolved.ok && (
            <div className="row-between" style={{ gap: 8 }}>
              <span className="label" style={{ fontSize: 12 }}>{t("session.quickEntryTotal")}</span>
              <span>{money(resolved.total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface PickProps {
  line: IResolvedItemLine;
  index: number;
  /** The pick just made, before the server's answer lands; then the server's. */
  picked: number | null;
  saving: boolean;
  /** `answered`: the server already resolved the line to this very product. */
  onPick: (index: number, raw: string, productId: number, answered: boolean, byKeyboard: boolean) => void;
  onEscape: () => void;
  listRef: (el: HTMLDivElement | null) => void;
}

/**
 * A line whose words fit SEVERAL products (2026-09-25): the operator says
 * which one. Nothing is picked for them — the line waits, the total waits,
 * and the confirm stays off until every such line has an answer.
 *
 * Every option is the server's (id, name, price, price × quantity); choosing
 * one only asks the server to read the box again with that pick, and the
 * server prices, merges and totals it. After the answer the line reads as
 * resolved and keeps its options, so the pick can still be changed.
 *
 * The options are a keyboard list (OptionList, 2026-09-26): Tab from the box
 * lands on it, ↑/↓ move, Enter picks, Escape goes back to the box.
 */
const QuickEntryPick = ({ line, index, picked, saving, onPick, onEscape, listRef }: PickProps) => {
  const { money, t } = useLang();
  const ask = fmt(t("session.quickEntryPick"), line.raw);

  return (
    <div className="quick-pick">
      {line.status === "ambiguous" ? (
        <span className="quick-pick__ask">{ask}</span>
      ) : line.error !== null ? (
        <span className="error" style={{ fontSize: 12 }}>
          {fmt(t("session.quickEntryLine"), line.raw)} {line.error}
        </span>
      ) : (
        <div className="row-between" style={{ gap: 8 }}>
          <span>✓ {line.name} × {line.qty}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            {money(line.price ?? 0)} · {money(line.line_total ?? 0)}
          </span>
        </div>
      )}
      <OptionList
        options={line.options ?? []}
        optionKey={(o) => o.product_id}
        selectedKey={picked}
        onChoose={(o, via) => onPick(
          index, line.raw, o.product_id,
          line.status === "matched" && line.product_id === o.product_id,
          via === "keyboard",
        )}
        label={ask}
        disabled={saving}
        onEscape={onEscape}
        listRef={listRef}
        renderOption={(o) => (
          <span className="quick-pick__option">
            <span className="quick-pick__name">{o.name}</span>
            <span className="muted quick-pick__price">
              {money(o.price)} × {line.qty} = {money(o.line_total ?? 0)}
            </span>
          </span>
        )}
      />
    </div>
  );
};

interface CreateFormProps {
  basket: ProductBasket;
  branchId: number;
  canCreateProducts: boolean;
}

/** The Products screen's own form, unchanged: whatever it creates is a real product. */
export const BasketCreateProduct = ({ basket, branchId, canCreateProducts }: CreateFormProps) =>
  basket.creating && canCreateProducts ? (
    <ProductForm
      branchId={branchId}
      onClose={() => basket.setCreating(false)}
      onSaved={basket.onProductCreated}
    />
  ) : null;

export const rowStyle: React.CSSProperties = {
  display: "flex", gap: 8, alignItems: "center",
  border: "1px solid #1f2a44",
  borderRadius: 8, padding: "8px 10px",
};

export const ellipsis: React.CSSProperties = {
  flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const plusBtn: React.CSSProperties = { padding: "4px 12px", fontSize: 16, lineHeight: 1.2, minWidth: 40 };

export const stepBtn: React.CSSProperties = { padding: "4px 10px", fontSize: 13, lineHeight: 1.2, minWidth: 36 };
