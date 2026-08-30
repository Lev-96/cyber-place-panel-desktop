import { GridSkeleton } from "@/components/ui/Skeleton";
import Spinner from "@/components/ui/Spinner";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { formatTime } from "@/i18n/dates";
import { useLang } from "@/i18n/LanguageContext";
import { useRealtimeBranch } from "@/hooks/useRealtimeBranch";
import { useLocalReorder } from "@/hooks/useLocalReorder";
import { platformGroup, platformLabel } from "@/utils/platform";
import { PlaceSnapshot } from "@/services/realtime/RealtimeService";
import { DragEvent, useState } from "react";
import Button from "@/components/ui/Button";
import PlaceCell from "./PlaceCell";
import StatusLegend from "./StatusLegend";

const LEAD_SECTIONS = ["pc", "ps"];

const sectionKeyOf = (platform: string): string => {
  const group = platformGroup(platform);
  return group === "other" ? platform : group;
};

const BranchLiveScreen = ({ branchId }: { branchId: number }) => {
  const { t } = useLang();
  const { snapshot, error, loading, refresh } = useRealtimeBranch(branchId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragSection, setDragSection] = useState<string | null>(null);
  const [dropSection, setDropSection] = useState<string | null>(null);

  const places = snapshot?.places ?? [];
  const grouped: Record<string, PlaceSnapshot[]> = {};
  for (const s of places) (grouped[sectionKeyOf(s.place.platform)] ||= []).push(s);
  const canonicalSections = [
    ...LEAD_SECTIONS.filter((k) => grouped[k]?.length),
    ...Object.keys(grouped).filter((k) => !LEAD_SECTIONS.includes(k)),
  ];
  const sectionReorder = useLocalReorder(`board:live:sections:${branchId}`, canonicalSections);

  if (loading && !snapshot) return <GridSkeleton cells={8} />;
  if (error && !snapshot) return <div className="error">{t("live.failedLoad")}</div>;
  if (!snapshot) return null;

  const sectionLabel = (key: string): string =>
    key === "pc" ? t("session.groupComputers") : key === "ps" ? t("session.groupPs") : platformLabel(key);

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

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

  const sectionKeys = sectionReorder.ordered;

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between">
        <h2 className="page-title" style={{ margin: 0 }}>{t("live.title")} · №{branchId}</h2>
        <div className="row" style={{ gap: 12 }}>
          <span className="muted">{t("live.updated")} {formatTime(snapshot.takenAt)}</span>
          <Button variant="secondary" onClick={refresh}>{t("action.refresh")}</Button>
        </div>
      </div>
      <StatusLegend totals={snapshot.totals} />

      {places.length === 0 ? null : (
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
                <div className="live-grid">
                  {items.map((s) => <PlaceCell key={s.place.id} snapshot={s} />)}
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default BranchLiveScreen;
