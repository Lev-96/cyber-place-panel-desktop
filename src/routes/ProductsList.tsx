import ProductForm from "@/components/products/ProductForm";
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { tr } from "@/i18n/translated";
import Button from "@/components/ui/Button";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { StateSwitch, deriveViewState } from "@/components/ui/state";
import { useAsync } from "@/hooks/useAsync";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { productRepository } from "@/repositories/ProductRepository";
import { IProduct } from "@/types/pos";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { isAdditionalProduct, ProductKind } from "@/types/pos";
import SectionTabs from "@/components/ui/SectionTabs";

const ProductsList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money, lang } = useLang();
  const { user } = useAuth();
  // Reading the catalogue needs no permission — every role sells from it at the
  // POS. Changing it is the company's call, so a manager gets the list and the
  // search box and no write control at all. The backend refuses the same
  // writes, so this is the button half of one rule, not the whole of it.
  const canEdit = can(user?.role, "product.crud");
  const confirm = useConfirm();
  const { data, loading, error, reload } = useAsync(() => productRepository.listByBranch(id), [id]);
  const [creating, setCreating] = useState(false);
  /**
   * Which catalogue is open (2026-09-27): what is SOLD, or what is HANDED OUT
   * with the seat. A new entry is created as the kind of the open section.
   */
  const [section, setSection] = useState<ProductKind>("regular");
  const [editing, setEditing] = useState<IProduct | null>(null);
  const [search, setSearch] = useState("");

  // Filtered here rather than through the API: the branch's catalogue arrives
  // whole and is small, the operator types against the name they can SEE (which
  // is the translated one), and a round trip per keystroke would answer slower
  // than the list re-renders. Category is matched too — "напитки" is how a
  // cashier narrows a long list.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const inSection = (data ?? []).filter((p) => (isAdditionalProduct(p) ? "additional" : "regular") === section);
    if (!needle) return inSection;
    return inSection.filter((p) =>
      `${tr(p, "name", lang)} ${tr(p, "category", lang)}`.toLowerCase().includes(needle),
    );
  }, [data, search, lang, section]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const searching = search.trim() !== "";
  const view = deriveViewState({ loading, error, data: data ? visible : null, hasFilters: searching });
  const newLabel = t(section === "additional" ? "products.newAdditional" : "products.new");

  const remove = async (p: IProduct) => {
    if (!(await confirm(`${t("action.delete")} ${tr(p, "name", lang)}?`, { destructive: true }))) return;
    await productRepository.remove(p.id, p.kind);
    void reload();
  };
  const toggle = async (p: IProduct) => {
    await productRepository.update(p.id, { is_active: !p.is_active }, p.kind);
    void reload();
  };

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("products.title")} · №{id}</h2>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            {t(section === "additional" ? "products.newAdditional" : "products.new")}
          </Button>
        )}
      </div>
      <SectionTabs
        label={t("session.addSections")}
        value={section}
        onChange={(k) => { setSection(k); setSearch(""); }}
        tabs={[
          { key: "regular", label: t("session.sectionProducts") },
          { key: "additional", label: t("session.additionalTitle") },
        ]}
      />
      <input
        className="input"
        placeholder={t("products.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <StateSwitch
        view={view}
        skeleton={<ListSkeleton />}
        onRetry={() => void reload()}
        error={{ titleKey: "products.state.errorTitle" }}
        empty={{
          titleKey: section === "additional" ? "products.state.emptyAdditionalTitle" : "products.state.emptyTitle",
          descriptionKey: section === "additional" ? "products.state.emptyAdditionalDescription" : "products.state.emptyDescription",
          actions: canEdit ? <Button onClick={() => setCreating(true)}>{newLabel}</Button> : undefined,
        }}
        noResults={{ descriptionKey: "products.state.noResultsDescription" }}
      >
        <div className="list">
          {visible.map((p) => (
            <div key={p.id} className="list-item" style={{ opacity: p.is_active ? 1 : 0.5 }}>
              <div>
                <div className="name">{tr(p, "name", lang)}</div>
                <div className="meta">{tr(p, "category", lang) || "-"} · {money(Number(p.price))}</div>
              </div>
              {canEdit && (
                <div className="row" style={{ gap: 6 }}>
                  {/* Show/hide is a write too — it takes a product off the POS —
                      so it goes with Edit and Delete rather than staying behind
                      as the one thing a manager could still change. */}
                  <Button variant="secondary" onClick={() => toggle(p)} style={btn}>{p.is_active ? t("action.hide") : t("action.show")}</Button>
                  <Button variant="secondary" onClick={() => setEditing(p)} style={btn}>{t("action.edit")}</Button>
                  <Button variant="secondary" onClick={() => remove(p)} style={{ ...btn, color: "#ef4444", borderColor: "#4a1a1a" }}>{t("action.delete")}</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </StateSwitch>
      {creating && <ProductForm branchId={id} kind={section} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {editing && <ProductForm branchId={id} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </div>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default ProductsList;
