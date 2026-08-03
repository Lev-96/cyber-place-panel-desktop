import PlaceForm from "@/components/places/PlaceForm";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useLocalReorder } from "@/hooks/useLocalReorder";
import { useReservedPlaceIds } from "@/hooks/useReservedPlaceIds";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { platformPriceNameOf } from "@/i18n/platformPriceName";
import { placeRepository } from "@/repositories/PlaceRepository";
import { platformPriceRepository } from "@/repositories/PlatformPriceRepository";
import { IBranchPlace } from "@/types/api";
import { platformGroup, platformLabel } from "@/utils/platform";
import { DragEvent, useState } from "react";
import { useParams } from "react-router-dom";

// Tile border / dot palette. Reserved wins over the place's own active/inactive
// status — a manager needs to see "this seat is currently held by a booking"
// even if its admin status is `active`.
const COLOR_RESERVED = "#f59e0b";
const COLOR_ACTIVE = "#22c55e";
const COLOR_IDLE = "#6b7280";

const LEAD_SECTIONS = ["pc", "ps"];

// The section a place belongs to — same rule the sessions board uses: pc,
// PS (global across generations), or each custom platform in its own section.
const sectionKeyOf = (p: IBranchPlace): string => {
  const group = platformGroup(p.platform);
  return group === "other" ? p.platform : group;
};

const BranchPlaces = () => {
  const { branchId } = useParams();
  const { t, lang } = useLang();
  const confirm = useConfirm();
  const id = Number(branchId);
  const { data, loading, error, reload } = useAsync(() => placeRepository.listRawByBranch(id), [id]);
  // Existing custom-platform prices — feed the place form so an already-priced
  // platform locks its rate (operator picks it) instead of re-entering one.
  const platformPrices = useAsync(() => platformPriceRepository.listByBranch(id), [id]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<IBranchPlace | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSection, setDragSection] = useState<string | null>(null);
  const [dropSection, setDropSection] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const reservedPlaceIds = useReservedPlaceIds(id);

  const places = data ?? [];
  const byPid = new Map(places.map((p) => [String(p.id), p] as const));
  // Distinct custom platforms already used in this branch — offered as
  // autocomplete when creating another place on a custom platform.
  const customPlatforms = Array.from(
    new Set([
      ...places.filter((p) => platformGroup(p.platform) === "other").map((p) => p.platform),
      ...(platformPrices.data ?? []).map((pp) => pp.platform),
    ]),
  );

  // Per-device tile order (places have no server sort_order, so ordering is a
  // local UI preference) and per-device section order.
  const tileReorder = useLocalReorder(`board:places:tiles:${id}`, places.map((p) => String(p.id)));
  const orderedPlaces = tileReorder.ordered.map((k) => byPid.get(k)).filter((p): p is IBranchPlace => !!p);

  const grouped: Record<string, IBranchPlace[]> = {};
  for (const p of orderedPlaces) (grouped[sectionKeyOf(p)] ||= []).push(p);

  const canonicalSections = [
    ...LEAD_SECTIONS.filter((k) => grouped[k]?.length),
    ...Object.keys(grouped).filter((k) => !LEAD_SECTIONS.includes(k)),
  ];
  const sectionReorder = useLocalReorder(`board:places:sections:${id}`, canonicalSections);

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("hub.invalidId")}</div>;

  const sectionLabel = (key: string): string =>
    key === "pc" ? t("session.groupComputers") : key === "ps" ? t("session.groupPs") : platformLabel(key);

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const remove = async (p: IBranchPlace) => {
    if (!(await confirm(fmt(t("branchPlaces.confirmDelete"), p.number ?? p.id), { destructive: true }))) return;
    await placeRepository.remove(p.id);
    void reload();
    // Deleting the last place on a custom platform auto-removes its price.
    void platformPrices.reload();
  };

  // Tile drag — scoped to a single section (a PC can't move into the PS group).
  const dropOn = (targetKey: string) => {
    const from = dragId;
    setDragId(null);
    setDragOverId(null);
    if (!from || from === targetKey) return;
    const fromP = byPid.get(from);
    const targetP = byPid.get(targetKey);
    if (!fromP || !targetP || sectionKeyOf(fromP) !== sectionKeyOf(targetP)) return;
    tileReorder.move(from, targetKey);
  };

  const onSectionDragStart = (key: string) => (e: DragEvent) => {
    const head = (e.currentTarget as HTMLElement).closest(".cp-section")?.querySelector(".cp-section-toggle");
    if (head) e.dataTransfer.setDragImage(head as Element, 20, 20);
    setDragSection(key);
  };
  const onSectionDrop = (key: string) => {
    const from = dragSection;
    setDragSection(null);
    setDropSection(null);
    if (!from || from === key) return;
    sectionReorder.move(from, key);
  };

  /**
   * The place's subcategory, in the panel language — or "" when it has none or
   * sits on the platform's Default, which is not worth a line of its own: every
   * platform has one, so labelling it would add noise to every card.
   */
  const subplatformLabel = (p: IBranchPlace): string => {
    const sp = p.subplatform;
    if (!sp || sp.is_default) return "";

    return platformPriceNameOf(sp, lang);
  };

  const renderCell = (p: IBranchPlace) => {
    const pid = String(p.id);
    const isReserved = reservedPlaceIds.has(p.id);
    const isActive = p.status === "active";
    const tone = isReserved ? COLOR_RESERVED : isActive ? COLOR_ACTIVE : COLOR_IDLE;
    const statusLabel = isReserved
      ? t("session.reserved") || "Reserved"
      : t(`branchPlaces.status.${p.status}`) || p.status;
    return (
      <div
        key={p.id}
        className={`place-cell${dragId === pid ? " is-dragging" : ""}${
          dragOverId === pid && dragId != null && dragId !== pid ? " is-drop-before" : ""
        }`}
        style={{ borderColor: tone, minHeight: 130 }}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragId != null && dragId !== pid) {
            const fromP = byPid.get(dragId);
            if (fromP && sectionKeyOf(fromP) === sectionKeyOf(p)) setDragOverId(pid);
          }
        }}
        onDrop={() => dropOn(pid)}
      >
        <span className="dot" style={{ background: tone }} />
        <span
          className="cell-grip"
          draggable
          onDragStart={(e) => {
            const cell = (e.currentTarget as HTMLElement).closest(".place-cell");
            if (cell) e.dataTransfer.setDragImage(cell, 24, 24);
            setDragId(pid);
          }}
          onDragEnd={() => { setDragId(null); setDragOverId(null); }}
          title={t("session.dragToReorder")}
          aria-label={t("session.dragToReorder")}
        >
          ⠿
        </span>
        <span className="platform" style={{ marginLeft: 18 }}>{platformLabel(p.platform)} · {p.type}</span>
        <span className="id">№{p.number ?? p.id}</span>
        <span className="status" style={{ color: tone }}>{statusLabel}</span>
        <span className="until">{p.games?.length ?? 0} {t("branchPlaces.games")}</span>
        {/* The subcategory line is rendered even when there is none — as a
            non-breaking space — so every card in the grid has the same number
            of lines and therefore the same height. Combined with the nowrap +
            ellipsis rules in `.place-cell .subplatform`, no name can change it. */}
        <span className="subplatform" title={subplatformLabel(p) || undefined}>
          {subplatformLabel(p) || "\u00A0"}
        </span>
        <div className="row cell-actions" style={{ gap: 4, marginTop: 6 }}>
          <Button variant="secondary" onClick={() => setEditing(p)} style={{ padding: "4px 8px", fontSize: 11, flex: 1 }}>{t("action.edit")}</Button>
          <Button variant="secondary" onClick={() => remove(p)} style={{ padding: "4px 8px", fontSize: 11, color: "#ef4444", borderColor: "#4a1a1a" }}>×</Button>
        </div>
      </div>
    );
  };

  const sectionKeys = sectionReorder.ordered;

  return (
    <ScreenWithBg bg="./bg/branch.jpg" title={`${t("branchPlaces.title")} · №${id}`}>
      <div className="row-between">
        <span className="muted">{t("branchPlaces.intro")}</span>
        <Button onClick={() => setCreating(true)}>{t("branchPlaces.new")}</Button>
      </div>
      {loading && <GridSkeleton />}
      {error && <div className="error">{error.message}</div>}
      {!loading && !error && (
        orderedPlaces.length === 0 ? (
          <div className="muted">{t("branchPlaces.empty")}</div>
        ) : (
          <div className="col" style={{ gap: 14 }}>
            {sectionKeys.map((key) => {
              const items = grouped[key];
              if (!items?.length) return null;
              return (
                <CollapsibleSection
                  key={key}
                  title={sectionLabel(key)}
                  count={items.length}
                  open={!collapsed.has(key)}
                  onToggle={() => toggleGroup(key)}
                  reorderable={sectionKeys.length > 1}
                  dragHint={t("session.dragSectionHint")}
                  dragging={dragSection === key}
                  dropTarget={dropSection === key && dragSection != null && dragSection !== key}
                  onDragStart={onSectionDragStart(key)}
                  onDragEnd={() => { setDragSection(null); setDropSection(null); }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragSection && dragSection !== key) setDropSection(key);
                  }}
                  onDrop={() => onSectionDrop(key)}
                >
                  <div className={`live-grid${dragId != null ? " is-reordering" : ""}`}>
                    {items.map(renderCell)}
                  </div>
                </CollapsibleSection>
              );
            })}
          </div>
        )
      )}

      {creating && <PlaceForm branchId={id} platformSuggestions={customPlatforms} platformPrices={platformPrices.data ?? []} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); void platformPrices.reload(); }} />}
      {editing && <PlaceForm branchId={id} initial={editing} platformSuggestions={customPlatforms} platformPrices={platformPrices.data ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); void platformPrices.reload(); }} />}
    </ScreenWithBg>
  );
};

export default BranchPlaces;
