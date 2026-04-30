import ProductForm from "@/components/pos/ProductForm";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { productRepository } from "@/repositories/ProductRepository";
import { IProduct } from "@/types/pos";
import { useState } from "react";
import { useParams } from "react-router-dom";

const ProductsList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money } = useLang();
  const { data, loading, error, reload } = useAsync(() => productRepository.listByBranch(id), [id]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IProduct | null>(null);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const remove = async (p: IProduct) => {
    if (!confirm(`${t("action.delete")} ${p.name}?`)) return;
    await productRepository.remove(p.id);
    void reload();
  };
  const toggle = async (p: IProduct) => {
    await productRepository.update(p.id, { is_active: !p.is_active });
    void reload();
  };

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("products.title")} · #{id}</h2>
        <Button onClick={() => setCreating(true)}>{t("products.new")}</Button>
      </div>
      {loading && <Spinner />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        <div className="list">
          {(data ?? []).map((p) => (
            <div key={p.id} className="list-item" style={{ opacity: p.is_active ? 1 : 0.5 }}>
              <div>
                <div className="name">{p.name}</div>
                <div className="meta">{p.category ?? "—"} · {money(Number(p.price))}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button variant="secondary" onClick={() => toggle(p)} style={btn}>{p.is_active ? t("action.hide") : t("action.show")}</Button>
                <Button variant="secondary" onClick={() => setEditing(p)} style={btn}>{t("action.edit")}</Button>
                <Button variant="secondary" onClick={() => remove(p)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>{t("action.delete")}</Button>
              </div>
            </div>
          ))}
          {!data?.length && <div className="muted">{t("products.empty")}</div>}
        </div>
      )}
      {creating && <ProductForm branchId={id} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {editing && <ProductForm branchId={id} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </div>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default ProductsList;
