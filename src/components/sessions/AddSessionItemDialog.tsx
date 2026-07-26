import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import PriceInput from "@/components/ui/PriceInput";
import Spinner from "@/components/ui/Spinner";
import { useLang } from "@/i18n/LanguageContext";
import { productRepository } from "@/repositories/ProductRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { ISessionApi } from "@/types/sessions";
import { IProduct } from "@/types/pos";
import { useEffect, useMemo, useState } from "react";

interface Props {
  branchId: number;
  session: ISessionApi;
  onClose: () => void;
  onAdded: () => void;
}

interface CatalogRow {
  key: string;
  name: string;
  category: string;
  price: number | null;
}

const AddSessionItemDialog = ({ branchId, session, onClose, onAdded }: Props) => {
  const { money, t } = useLang();
  const [products, setProducts] = useState<IProduct[] | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  useEffect(() => {
    void productRepository.listByBranch(branchId).then(setProducts);
  }, [branchId]);

  useEffect(() => {
    if (!lastAdded) return;
    const tt = setTimeout(() => setLastAdded(null), 2_000);
    return () => clearTimeout(tt);
  }, [lastAdded]);

  const flashAdded = (label: string) => {
    setLastAdded(label);
    onAdded();
  };

  const catalog: CatalogRow[] = useMemo(() => {
    const rows: CatalogRow[] = [];
    for (const p of products ?? []) {
      rows.push({
        key: `p-${p.id}`,
        name: p.name,
        category: t("session.products"),
        price: Number(p.price),
      });
    }
    return rows;
  }, [products, t]);

  const filtered = catalog.filter((r) =>
    !search.trim() || r.name.toLowerCase().includes(search.toLowerCase())
  );

  const addRow = async (r: CatalogRow) => {
    if (r.price == null || r.price <= 0) {
      setErr(`${r.name}: ${t("session.fillNamePrice")}`);
      return;
    }
    setBusy(true); setErr(null);
    try {
      await sessionRepository.addItem(session.id, { name: r.name, price: r.price, qty: 1 });
      flashAdded(r.name);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const addCustom = async () => {
    const price = parseFloat(customPrice.replace(",", "."));
    if (!customName.trim() || !Number.isFinite(price) || price < 0) {
      setErr(t("session.fillNamePrice"));
      return;
    }
    setBusy(true); setErr(null);
    try {
      const name = customName.trim();
      await sessionRepository.addItem(session.id, { name, price, qty: 1 });
      flashAdded(name);
      setCustomName("");
      setCustomPrice("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const deviceLabel = session.pc_label ?? `№${session.pc_id}`;
  const loading = products === null;

  return (
    <Modal open onClose={onClose}>
      <div className="card" style={{ width: 540, maxWidth: "92vw", display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("session.addItem")}</h2>
        <span className="muted" style={{ fontSize: 12 }}>{deviceLabel}</span>

        {lastAdded && (
          <div style={toastStyle}>{t("session.added")}: <b>{lastAdded}</b></div>
        )}

        {catalog.length > 0 && (
          <Input placeholder={t("session.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        )}

        {loading ? <Spinner /> : (
          <div className="col" style={{ gap: 6, maxHeight: 280, overflowY: "auto" }}>
            {catalog.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>{t("session.noProducts")}</div>
            )}
            {filtered.map((r) => (
              <button
                type="button"
                key={r.key}
                onClick={() => addRow(r)}
                disabled={busy}
                style={catalogRow}
              >
                <span style={{ flex: 1, textAlign: "left" }}>{r.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>{r.category}</span>
                <span style={{ fontWeight: 700, minWidth: 80, textAlign: "right" }}>
                  {r.price != null ? money(r.price) : "—"}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="col" style={{ gap: 8, borderTop: "1px solid #1f2a44", paddingTop: 12 }}>
          <span className="label" style={{ fontSize: 12 }}>{t("session.customItem")}</span>
          <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
            <Input
              label=""
              placeholder={t("session.itemName")}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              style={{ flex: 2 }}
            />
            <div style={{ flex: 1 }}>
              <PriceInput
                placeholder={t("session.itemPrice")}
                value={customPrice}
                onChange={setCustomPrice}
              />
            </div>
            <Button onClick={addCustom} disabled={busy} style={{ minWidth: 110 }}>{t("action.add")}</Button>
          </div>
        </div>

        {err && <div className="error">{err}</div>}
        <div className="row-between">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t("action.close")}</Button>
        </div>
      </div>
    </Modal>
  );
};

const toastStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "rgba(34, 197, 94, 0.12)",
  border: "1px solid #22c55e",
  borderRadius: 8,
  color: "#86efac",
  fontSize: 13,
};

const catalogRow: React.CSSProperties = {
  display: "flex", gap: 10, alignItems: "center",
  border: "1px solid #1f2a44",
  borderRadius: 8, padding: "10px 12px", cursor: "pointer",
  background: "transparent",
  color: "inherit",
  font: "inherit",
};

export default AddSessionItemDialog;
