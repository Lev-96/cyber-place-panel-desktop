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
import ProductHistory from "@/components/products/ProductHistory";
import { productEventRepository } from "@/repositories/ProductEventRepository";

/** The screen's two views: the catalogue itself, and the trail of changes to it. */
type Pane = "catalogue" | "history";

const ProductsList = () => {
  const { branchId } = useParams();
  const id = Number(branchId);
  const { t, money, lang } = useLang();
  const { user } = useAuth();
  // Reading the catalogue needs no permission — every role sells from it at the
  // POS. Since 2026-11-09 the manager writes it too (create, edit, price,
  // deactivate: `product.write`); DELETE stays the owner's (`product.crud`),
  // so a manager takes a product off the till by deactivating it. The backend
  // refuses the same writes, so this is the button half of one rule.
  const canEdit = can(user?.role, "product.write");
  const canDelete = can(user?.role, "product.crud");
  // The trail is the owner's and the admin's. A backend from before it answers
  // 404, and then there is no tab to open; the probe is never sent for anyone
  // without the permission.
  const mayReadHistory = can(user?.role, "product.history");
  const historyProbe = useAsync(
    () => (mayReadHistory && Number.isFinite(id) && id > 0 ? productEventRepository.available(id) : Promise.resolve(false)),
    [mayReadHistory, id],
  );
  const canHistory = mayReadHistory && historyProbe.data === true;
  const [pane, setPane] = useState<Pane>("catalogue");
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

  const showHistory = canHistory && pane === "history";

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("products.title")} · №{id}</h2>
        {canEdit && !showHistory && (
          <Button onClick={() => setCreating(true)}>
            {t(section === "additional" ? "products.newAdditional" : "products.new")}
          </Button>
        )}
      </div>
      {canHistory && (
        <SectionTabs
          label={t("products.views")}
          value={pane}
          onChange={setPane}
          tabs={[
            { key: "catalogue", label: t("products.viewCatalogue") },
            { key: "history", label: t("products.viewHistory") },
          ]}
        />
      )}
      {showHistory && <ProductHistory initialBranchId={id} />}
      {!showHistory && (
        <>
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
                      {/* Show/hide is the deactivate: it takes a product off the
                          POS and keeps it, which is what a manager has instead of
                          Delete. */}
                      <Button variant="secondary" onClick={() => toggle(p)} style={btn}>{p.is_active ? t("action.hide") : t("action.show")}</Button>
                      <Button variant="secondary" onClick={() => setEditing(p)} style={btn}>{t("action.edit")}</Button>
                      {canDelete && (
                        <Button variant="secondary" onClick={() => remove(p)} style={{ ...btn, color: "var(--color-danger)", borderColor: "var(--color-danger-border-dim)" }}>{t("action.delete")}</Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </StateSwitch>
        </>
      )}
      {creating && <ProductForm branchId={id} kind={section} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} />}
      {editing && <ProductForm branchId={id} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
    </div>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default ProductsList;
