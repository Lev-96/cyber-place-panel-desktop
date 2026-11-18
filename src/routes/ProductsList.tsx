import ProductForm from "@/components/products/ProductForm";
import ProductStockDialog from "@/components/products/ProductStockDialog";
import { stockNumber } from "@/components/products/stock";
import { fmt } from "@/i18n/translations";
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
import { countsStock, isAdditionalProduct, isFastFoodProduct, isHourlyAdditional } from "@/types/pos";
import { branchRepository } from "@/repositories/BranchRepository";
import { partnerRepository } from "@/repositories/PartnerRepository";
import SectionTabs from "@/components/ui/SectionTabs";
import ProductHistory from "@/components/products/ProductHistory";
import { productEventRepository } from "@/repositories/ProductEventRepository";

/** The screen's two views: the catalogue itself, and the trail of changes to it. */
type Pane = "catalogue" | "history";

/**
 * The catalogue's sections: what is SOLD, the fast food (2026-11-18, owner:
 * «Быстрая Еда», a regular product with the flag), and what is HANDED OUT
 * with the seat.
 */
type Section = "regular" | "fastFood" | "additional";

const sectionOf = (p: IProduct): Section =>
  isAdditionalProduct(p) ? "additional" : isFastFoodProduct(p) ? "fastFood" : "regular";

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
  // Stock (2026-11-16): receiving goods and a first count are `product.write`;
  // a recount of a counted product and switching it off are the owner's.
  const canCorrectStock = can(user?.role, "product.stockCorrect");
  // The trail is the owner's and the admin's. A backend from before it answers
  // 404, and then there is no tab to open; the probe is never sent for anyone
  // without the permission.
  const mayReadHistory = can(user?.role, "product.history");
  const historyProbe = useAsync(
    () => (mayReadHistory && Number.isFinite(id) && id > 0 ? productEventRepository.available(id) : Promise.resolve(false)),
    [mayReadHistory, id],
  );
  const canHistory = mayReadHistory && historyProbe.data === true;
  /**
   * Whose fast food it is (2026-11-18): the company's partners, read only for
   * someone who may manage them. A manager never asks (the server answers
   * 403) and never sees a partner on this screen.
   */
  const managesPartners = can(user?.role, "partners.manage");
  const partners = useAsync(
    async () => {
      if (!managesPartners || !Number.isFinite(id) || id <= 0) return null;
      const branch = await branchRepository.byId(id);
      return partnerRepository.list(branch.company_id, true);
    },
    [managesPartners, id],
  );
  const partnerName = (partnerId: number | null | undefined): string | null =>
    partnerId == null ? null : partners.data?.find((p) => p.id === partnerId)?.name ?? null;
  const [pane, setPane] = useState<Pane>("catalogue");
  const confirm = useConfirm();
  // The catalogue and the server's stock total, in one read.
  const { data: listed, loading, error, reload } = useAsync(() => productRepository.listWithStock(id), [id]);
  const data = listed?.products ?? null;
  const stockMeta = listed?.stock ?? null;
  const [creating, setCreating] = useState(false);
  const [stocking, setStocking] = useState<IProduct | null>(null);
  /**
   * Which catalogue is open (2026-09-27): what is SOLD, or what is HANDED OUT
   * with the seat. A new entry is created as the kind of the open section.
   */
  const [section, setSection] = useState<Section>("regular");
  const [editing, setEditing] = useState<IProduct | null>(null);
  const [search, setSearch] = useState("");

  // Filtered here rather than through the API: the branch's catalogue arrives
  // whole and is small, the operator types against the name they can SEE (which
  // is the translated one), and a round trip per keystroke would answer slower
  // than the list re-renders. Category is matched too — "напитки" is how a
  // cashier narrows a long list.
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const inSection = (data ?? []).filter((p) => sectionOf(p) === section);
    if (!needle) return inSection;
    return inSection.filter((p) =>
      `${tr(p, "name", lang)} ${tr(p, "category", lang)}`.toLowerCase().includes(needle),
    );
  }, [data, search, lang, section]);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const searching = search.trim() !== "";
  const view = deriveViewState({ loading, error, data: data ? visible : null, hasFilters: searching });
  const newLabel = t(section === "additional" ? "products.newAdditional" : section === "fastFood" ? "products.newFastFood" : "products.new");
  const emptyKeys = section === "additional"
    ? { titleKey: "products.state.emptyAdditionalTitle", descriptionKey: "products.state.emptyAdditionalDescription" }
    : section === "fastFood"
      ? { titleKey: "products.state.emptyFastFoodTitle", descriptionKey: "products.state.emptyFastFoodDescription" }
      : { titleKey: "products.state.emptyTitle", descriptionKey: "products.state.emptyDescription" };
  /** Sold by the unit (products and fast food): the stock line and button belong there. */
  const soldByUnit = section !== "additional";

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
          <Button onClick={() => setCreating(true)} data-testid="product-new">{newLabel}</Button>
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
      {/* The server's total of what the counted products hold (2026-11-16). */}
      {!showHistory && section === "regular" && stockMeta !== null && stockMeta.tracked > 0 && (
        <div className="product-stock-total" data-testid="product-stock-total">
          <span>{fmt(t("stock.total"), stockNumber(stockMeta.units))}</span>
          {stockMeta.negative > 0 && (
            <span className="product-stock-total__negative" data-testid="product-stock-negative">{fmt(t("stock.negative"), stockMeta.negative)}</span>
          )}
        </div>
      )}
      {!showHistory && (
        <>
          {/* Three sections since «Быстрая Еда» (2026-11-18): on a narrow
              window they wrap whole instead of cutting each name to «Ապր…». */}
          <div className="cp-subtabs-wrap">
          <SectionTabs
            label={t("session.addSections")}
            value={section}
            onChange={(k) => { setSection(k); setSearch(""); }}
            tabs={[
              { key: "regular", label: t("session.sectionProducts") },
              { key: "fastFood", label: t("products.tabFastFood") },
              { key: "additional", label: t("session.additionalTitle") },
            ]}
          />
          </div>
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
              ...emptyKeys,
              actions: canEdit ? <Button onClick={() => setCreating(true)}>{newLabel}</Button> : undefined,
            }}
            noResults={{ descriptionKey: "products.state.noResultsDescription" }}
          >
            <div className="list">
              {visible.map((p) => (
                <div key={p.id} className="list-item product-row" style={{ opacity: p.is_active ? 1 : 0.5 }} data-testid="product-row">
                  <div className="product-row__main">
                    <div className="name">{tr(p, "name", lang)}</div>
                    <div className="meta">
                      {tr(p, "category", lang) || "-"} · {money(Number(p.price))}
                      {/* An item that changes the seat's rate says so (2026-11-17). */}
                      {isHourlyAdditional(p) && (
                        <span data-testid="product-hourly">{t("session.perHourShort")} · {t("joystickPrice.strategy.hourly")}</span>
                      )}
                      {/* A product sold by the unit says its count (2026-11-16). */}
                      {soldByUnit && (
                        <>
                          {" · "}
                          <span className={`product-stock${countsStock(p) && (p.stock as number) < 0 ? " is-negative" : ""}`} data-testid="product-stock">
                            {countsStock(p) ? fmt(t("stock.left"), stockNumber(p.stock as number)) : t("stock.notCounted")}
                          </span>
                        </>
                      )}
                    </div>
                    {/* Whose fast food it is (2026-11-18): only for someone who
                        manages partners; the club's own says so. */}
                    {section === "fastFood" && managesPartners && partners.data && (
                      <div className="meta" data-testid="product-partner-name">
                        {partnerName(p.partner_id) !== null
                          ? fmt(t("products.partnerOf"), partnerName(p.partner_id) as string)
                          : t("product.partnerOwn")}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="row product-row__actions" style={{ gap: 6 }}>
                      {/* Show/hide is the deactivate: it takes a product off the
                          POS and keeps it, which is what a manager has instead of
                          Delete. */}
                      {soldByUnit && (
                        <Button variant="secondary" onClick={() => setStocking(p)} style={btn} aria-label={fmt(t("stock.buttonFull"), tr(p, "name", lang))} data-testid="product-stock-button">
                          {t("stock.button")}
                        </Button>
                      )}
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
      {creating && (
        <ProductForm
          branchId={id}
          kind={section === "additional" ? "additional" : "regular"}
          fastFood={section === "fastFood"}
          partners={managesPartners ? partners.data : undefined}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); void reload(); }}
        />
      )}
      {editing && (
        <ProductForm
          branchId={id}
          initial={editing}
          partners={managesPartners ? partners.data : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
      {stocking && (
        <ProductStockDialog
          product={stocking}
          canCorrect={canCorrectStock}
          onClose={() => setStocking(null)}
          onDone={() => { setStocking(null); void reload(); }}
        />
      )}
    </div>
  );
};

const btn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, minWidth: 80, textAlign: "center" };

export default ProductsList;
