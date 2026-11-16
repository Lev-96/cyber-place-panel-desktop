import Button from "@/components/ui/Button";
import ChoiceCards from "@/components/ui/ChoiceCards";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { StockActionBody } from "@/api/products";
import { tr } from "@/i18n/translated";
import { fmt } from "@/i18n/translations";
import { useLang } from "@/i18n/LanguageContext";
import { productRepository } from "@/repositories/ProductRepository";
import { countsStock, IProduct } from "@/types/pos";
import { notify } from "@/ui/notify";
import { newRequestId } from "@/utils/requestId";
import { useRef, useState } from "react";
import { parseQuantity, stockChangeText, stockNumber } from "./stock";

type Action = "add" | "set" | "untrack";

interface Props {
  product: IProduct;
  /** `product.stockCorrect` (owner, admin): a recount of a counted product, or counting off. */
  canCorrect: boolean;
  onClose: () => void;
  onDone: (product: IProduct) => void;
}

/**
 * A product's stock (2026-11-16): goods received («Приход», +N), a recount
 * («Пересчёт», the figure on the shelf), counting switched off («Не
 * учитывать»). A product not counted yet has one thing to do: «Начать учёт»
 * with what is on the shelf. Whoever writes the catalogue receives goods and
 * starts the count; only the owner recounts or switches it off (the server
 * asks the same, under its row lock). Every figure shown after is the
 * server's answer. One press is one receipt (`client_request_id`).
 */
const ProductStockDialog = ({ product, canCorrect, onClose, onDone }: Props) => {
  const { t, lang } = useLang();
  const counted = countsStock(product);
  const actions: Action[] = counted ? (canCorrect ? ["add", "set", "untrack"] : ["add"]) : ["set"];
  const [action, setAction] = useState<Action>(actions[0]);
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const requestId = useRef(newRequestId());
  const name = tr(product, "name", lang) || product.name;

  const label = (a: Action): string =>
    a === "add" ? t("stock.action.add") : a === "untrack" ? t("stock.action.untrack") : counted ? t("stock.action.set") : t("stock.action.start");
  const hint = (a: Action): string =>
    a === "add" ? t("stock.action.addHint") : a === "untrack" ? t("stock.action.untrackHint") : counted ? t("stock.action.setHint") : t("stock.action.startHint");

  const confirm = async () => {
    if (busy) return;
    let body: StockActionBody;
    if (action === "untrack") {
      body = { action, client_request_id: requestId.current };
    } else {
      const read = parseQuantity(qty, action === "add" ? 1 : 0);
      if (read.kind !== "ok") return setErr(t(action === "add" ? "stock.errors.qty" : "stock.errors.count"));
      body = action === "add"
        ? { action, qty: read.value, client_request_id: requestId.current }
        : { action, stock: read.value, client_request_id: requestId.current };
    }

    setBusy(true); setErr(null);
    try {
      const r = await productRepository.stock(product.id, body);
      notify.message("success", r.change.before === r.change.after && r.change.after !== null
        ? fmt(t("stock.unchanged"), name, stockNumber(r.change.after))
        : fmt(t("stock.done"), name, stockChangeText(r.change, t("stock.notCounted"))));
      onDone(r.product);
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : t("form.errors.failedSave"));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose}>
      <div className="card product-stock-dialog" data-testid="product-stock-dialog">
        <h2 style={{ margin: 0 }}>{fmt(t("stock.title"), name)}</h2>
        <span className="product-stock-dialog__now" data-testid="product-stock-now">
          {fmt(t("stock.now"), counted ? stockNumber(product.stock as number) : t("stock.notCounted"))}
        </span>

        {actions.length > 1 ? (
          <ChoiceCards
            label={t("stock.actions")}
            name={`product-stock-${product.id}`}
            value={action}
            onChange={(a) => { setAction(a); setErr(null); }}
            disabled={busy}
            testId="product-stock-action"
            choices={actions.map((a) => ({ key: a, title: label(a), detail: hint(a) }))}
          />
        ) : (
          <div className="col" style={{ gap: 2 }}>
            <strong>{label(action)}</strong>
            <span className="muted" style={{ fontSize: 12 }}>{hint(action)}</span>
          </div>
        )}

        {action !== "untrack" && (
          <Input
            label={t("stock.qty")}
            type="text"
            inputMode="numeric"
            autoFocus
            value={qty}
            onChange={(e) => { setQty(e.target.value); setErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void confirm(); } }}
            disabled={busy}
            data-testid="product-stock-qty"
          />
        )}
        {counted && !canCorrect && <span className="muted" style={{ fontSize: 12 }}>{t("stock.ownerOnly")}</span>}

        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t("action.cancel")}</Button>
          <Button type="button" onClick={() => void confirm()} disabled={busy} data-testid="product-stock-confirm">
            {busy ? "…" : action === "untrack" ? t("stock.action.untrack") : t("action.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProductStockDialog;
