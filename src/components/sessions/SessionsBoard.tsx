import { useAuth } from "@/auth/AuthContext";
import { tr } from "@/i18n/translated";
import { can } from "@/auth/permissions";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { useLocalReorder } from "@/hooks/useLocalReorder";
import { useReservedPlaceIds } from "@/hooks/useReservedPlaceIds";
import { useLang } from "@/i18n/LanguageContext";
import { usePlaceAvailability } from "@/realtime/usePlaceAvailability";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_STATUS_COLOR, effectivePcStatus, isPs } from "@/types/pc";
import {
  canStartSession,
  resolveSessionCellState,
  SESSION_CELL_COLOR,
} from "@/domain/SessionCellState";
import { platformGroup, platformLabel } from "@/utils/platform";
import { DragEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AddSessionItemDialog from "./AddSessionItemDialog";
import SessionTimer from "./SessionTimer";
import StartSessionDialog from "./StartSessionDialog";
import StopReceiptModal from "./StopReceiptModal";

const navBtn: React.CSSProperties = { padding: "6px 10px", border: "1px solid #1f2a44", borderRadius: 6 };

// The two lead sections shown before any custom-platform sections.
const LEAD_SECTIONS = ["pc", "ps"];

// The board section a device belongs to. Computers → "pc", any PlayStation
// generation → "ps" (global), and each CUSTOM platform gets its OWN section
// keyed by its slug (table-tennis, poker, …). Falls back to the device kind
// when a device isn't linked to a place yet.
const sectionKeyOf = (pc: IPcApi): string => {
  const platform = pc.place?.platform;
  if (platform) {
    const group = platformGroup(platform);
    return group === "other" ? platform : group;
  }
  return isPs(pc.kind) ? "ps" : "pc";
};

interface Props {
  branchId: number;
}

const SessionsBoard = ({ branchId }: Props) => {
  const { money, t, lang } = useLang();
  const { user } = useAuth();
  const role = user?.role;
  const pcs = useAsync(() => sessionRepository.listPcs(branchId), [branchId]);
  const sessions = useAsync(() => sessionRepository.listActive(branchId), [branchId]);
  const [startTarget, setStartTarget] = useState<IPcApi | null>(null);
  const [stopTarget, setStopTarget] = useState<ISessionApi | null>(null);
  const [addItemTarget, setAddItemTarget] = useState<ISessionApi | null>(null);
  // Local display order for tile drag-and-drop. Seeded from the server order
  // (which already reflects sort_order) and preserved across Reverb/poll
  // reloads, so a just-dragged arrangement doesn't jump back before the persist
  // round-trips.
  const [order, setOrder] = useState<number[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  // Section drag-and-drop (order persisted per-device via useLocalReorder).
  const [dragSection, setDragSection] = useState<string | null>(null);
  const [dropSection, setDropSection] = useState<string | null>(null);
  // Which sections are collapsed. Empty = all open (the default).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const reservedPlaceIds = useReservedPlaceIds(branchId);

  usePlaceAvailability(
    branchId,
    useCallback(() => {
      void sessions.reload();
      void pcs.reload();
    }, [sessions, pcs]),
  );

  useEffect(() => {
    const t = setInterval(() => {
      void sessions.reload();
      void pcs.reload();
    }, 30_000);
    return () => clearInterval(t);
  }, [sessions, pcs]);

  // Reconcile the local tile order with the server list: keep existing order
  // for devices still present, append new ones, drop removed ones.
  useEffect(() => {
    const ids = (pcs.data ?? []).map((p) => p.id);
    setOrder((prev) => {
      const present = new Set(ids);
      const kept = prev.filter((id) => present.has(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [pcs.data]);

  const sessionByPc = new Map<number, ISessionApi>();
  for (const s of sessions.data ?? []) sessionByPc.set(s.pc_id, s);

  const byId = new Map((pcs.data ?? []).map((p) => [p.id, p] as const));
  const orderedPcs = order.map((id) => byId.get(id)).filter((p): p is IPcApi => !!p);

  // Bucket devices into sections, preserving tile order within each.
  const grouped: Record<string, IPcApi[]> = {};
  for (const pc of orderedPcs) (grouped[sectionKeyOf(pc)] ||= []).push(pc);

  // Canonical section order: computers, then PS, then custom platforms in the
  // order they first appear. useLocalReorder lets the operator re-arrange them.
  const canonicalSections = [
    ...LEAD_SECTIONS.filter((k) => grouped[k]?.length),
    ...Object.keys(grouped).filter((k) => !LEAD_SECTIONS.includes(k)),
  ];
  const sectionReorder = useLocalReorder(`board:sessions:sections:${branchId}`, canonicalSections);
  const sectionKeys = sectionReorder.ordered;

  const sectionLabel = (key: string): string =>
    key === "pc" ? t("session.groupComputers") : key === "ps" ? t("session.groupPs") : platformLabel(key);

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // Persist the tile order; drag is scoped to a single section (a computer
  // can't be dropped into the PS section — its section comes from the platform).
  const dropOn = (targetId: number) => {
    const from = dragId;
    setDragId(null);
    setDragOverId(null);
    if (from == null || from === targetId) return;
    const fromPc = byId.get(from);
    const targetPc = byId.get(targetId);
    if (!fromPc || !targetPc || sectionKeyOf(fromPc) !== sectionKeyOf(targetPc)) return;
    setOrder((prev) => {
      const next = prev.filter((id) => id !== from);
      const idx = next.indexOf(targetId);
      next.splice(idx < 0 ? next.length : idx, 0, from);
      void sessionRepository.reorderPcs(branchId, next).catch(() => {});
      return next;
    });
  };

  const onSectionDragStart = (key: string) => (e: DragEvent) => {
    // Use the section header as the drag image for a clean preview.
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

  const renderCell = (pc: IPcApi) => {
    const sess = sessionByPc.get(pc.id);
    const isReserved = !sess && pc.place_id != null && reservedPlaceIds.has(pc.place_id);
    // Seat availability (session / booking) and DEVICE availability (is the
    // kiosk agent connected?) are different questions — resolveSessionCellState
    // is the single place that combines them, so tile colour, status text and
    // the Start button can never tell three different stories.
    const cellState = resolveSessionCellState({ hasSession: !!sess, isReserved, device: pc });
    const isOffline = cellState === "offline";
    const canStart = canStartSession(cellState);
    const deviceStatus = effectivePcStatus(pc);
    const color = SESSION_CELL_COLOR[cellState];
    const itemsCount = sess?.items?.length ?? 0;
    return (
      <div
        key={pc.id}
        className={`place-cell${dragId === pc.id ? " is-dragging" : ""}${
          dragOverId === pc.id && dragId != null && dragId !== pc.id ? " is-drop-before" : ""
        }`}
        style={{ borderColor: color, minHeight: 160 }}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragId != null && dragId !== pc.id) {
            const fromPc = byId.get(dragId);
            if (fromPc && sectionKeyOf(fromPc) === sectionKeyOf(pc)) setDragOverId(pc.id);
          }
        }}
        onDrop={() => dropOn(pc.id)}
      >
        <span className="dot" style={{ background: color }} />
        <span
          className="cell-grip"
          draggable
          onDragStart={(e) => {
            const cell = (e.currentTarget as HTMLElement).closest(".place-cell");
            if (cell) e.dataTransfer.setDragImage(cell, 24, 24);
            setDragId(pc.id);
          }}
          onDragEnd={() => { setDragId(null); setDragOverId(null); }}
          title={t("session.dragToReorder")}
          aria-label={t("session.dragToReorder")}
        >
          ⠿
        </span>
        <span className="platform" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginLeft: 18 }}>
          <span
            title={deviceStatus}
            style={{ width: 8, height: 8, borderRadius: 4, background: PC_STATUS_COLOR[deviceStatus], flexShrink: 0 }}
          />
          <span>{tr(pc.place, "name", lang).trim() || `№${pc.place?.number ?? tr(pc, "label", lang)}`}</span>
          {pc.place && pc.place.platform !== "pc" && (
            <span className="muted" style={{ fontSize: 11 }}>{platformLabel(pc.place.platform)}</span>
          )}
        </span>
        {sess ? (
          <>
            <span className="status" style={{ color }}>
              <SessionTimer
                endsAt={sess.ends_at}
                startedAt={sess.started_at}
                hourlyRate={sess.hourly_rate}
                formatMoney={money}
              />
            </span>
            <span className="until">
              {sess.mode === "open"
                ? `${money(Number(sess.hourly_rate ?? 0))} / ${t("time.hourShort") || "h"}`
                : sess.package_name}
              {itemsCount > 0 && <span className="muted"> · {itemsCount} {t("session.posNote")}</span>}
            </span>
            <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => setAddItemTarget(sess)} style={miniBtnFlex}>{t("session.addItem")}</Button>
              <Button variant="secondary" onClick={() => setStopTarget(sess)} style={miniBtnFlex}>{t("action.stop")}</Button>
            </div>
          </>
        ) : (
          <>
            <span className="status" style={{ color }}>
              {isOffline
                ? t("session.deviceOffline")
                : isReserved
                  ? t("session.reserved") || "Reserved"
                  : `${t("session.free")}${pc.place && pc.place.platform !== "pc" ? ` · ${platformLabel(pc.place.platform)}` : ""}`}
            </span>
            {isOffline && (
              <span className="until muted" style={{ fontSize: 11 }}>{t("session.deviceOfflineHint")}</span>
            )}
            <Button
              onClick={() => setStartTarget(pc)}
              disabled={!canStart}
              title={isOffline ? t("session.deviceOfflineHint") : undefined}
              style={{ padding: "6px 10px", fontSize: 12, marginTop: 6 }}
            >
              {t("action.start")}
            </Button>
          </>
        )}
      </div>
    );
  };

  if ((pcs.loading && !pcs.data) || (sessions.loading && !sessions.data)) return <GridSkeleton />;
  if (pcs.error && !pcs.data) return <div className="error">{pcs.error.message}</div>;
  if (sessions.error && !sessions.data) return <div className="error">{sessions.error.message}</div>;

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between" style={{ flexWrap: "wrap", rowGap: 8 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{t("session.boardTitle")} · №{branchId}</h2>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", rowGap: 8 }}>
          <Link to={`/branches/${branchId}/sessions/history`} className="muted" style={navBtn}>{t("history.title")}</Link>
          <Link to={`/branches/${branchId}/pcs`} className="muted" style={navBtn}>{t("pcs.title")}</Link>
          {can(role, "branch.prices") && (
            <Link to={`/branches/${branchId}/tariffs`} className="muted" style={navBtn}>{t("hub.tile.prices")}</Link>
          )}
        </div>
      </div>

      {orderedPcs.length === 0 ? (
        <div className="muted">{t("session.noPcs")}</div>
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
      )}

      {startTarget && (
        <StartSessionDialog
          branchId={branchId}
          pc={startTarget}
          onClose={() => setStartTarget(null)}
          onStarted={() => { setStartTarget(null); void sessions.reload(); void pcs.reload(); }}
        />
      )}
      {stopTarget && (
        <StopReceiptModal
          session={stopTarget}
          onClose={() => { setStopTarget(null); void sessions.reload(); void pcs.reload(); }}
          onConfirmed={() => { void sessions.reload(); void pcs.reload(); }}
          onItemRemoved={() => { void sessions.reload(); }}
        />
      )}
      {addItemTarget && (
        <AddSessionItemDialog
          branchId={branchId}
          session={addItemTarget}
          onClose={() => { setAddItemTarget(null); void sessions.reload(); }}
          onAdded={() => { void sessions.reload(); }}
        />
      )}
    </div>
  );
};

const miniBtnFlex: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  flex: "1 0 auto",
  minWidth: 0,
};

export default SessionsBoard;
