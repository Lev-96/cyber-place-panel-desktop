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
import { useSessionChanged } from "@/realtime/useSessionChanged";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_STATUS_COLOR, effectivePcStatus, isPs } from "@/types/pc";
import {
  canStartSession,
  resolveSessionCellState,
  SESSION_CELL_COLOR,
} from "@/domain/SessionCellState";
import { platformGroup, platformLabel } from "@/utils/platform";
import { usePs5Control } from "@/ps5/Ps5ControlProvider";
import { PS5_STATE_LOOK } from "@/ps5/stateLook";
import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AddSessionItemDialog from "./AddSessionItemDialog";
import SessionTimer from "./SessionTimer";
import StartSessionDialog from "./StartSessionDialog";
import SessionOptionsDialog from "./SessionOptionsDialog";
import { MAX_JOYSTICKS } from "@/api/joystickPrices";
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
  const [optionsTarget, setOptionsTarget] = useState<ISessionApi | null>(null);
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

  // Read from the app-wide watcher rather than starting a second one: two would
  // each raise their own question about the same console, and the owner would
  // be asked twice. It watches every venue this account can see, so a console
  // switched on by hand is noticed whatever screen is open — which is the whole
  // reason it no longer lives here.
  //
  // PC places are untouched by every line of it: a device with no console bound
  // is not watched at all.
  const { views: consoleViews, statuses: consoleStatuses, sessionStarting, sessionStopped } = usePs5Control();

  usePlaceAvailability(
    branchId,
    useCallback(() => {
      void sessions.reload();
      void pcs.reload();
    }, [sessions, pcs]),
  );

  // A session's TERMS changed on another machine — a pad in or out, time
  // granted, the ceiling lifted, the bill waived. Without this the second
  // cashier's board found out on its next 30-second poll, which is half a
  // minute of two people acting on different numbers over the same till.
  useSessionChanged(
    branchId,
    useCallback(() => {
      void sessions.reload();
    }, [sessions]),
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
    // Pads in play INCLUDING the session's own, as the server counts them.
    // An older backend sends nothing, and 1 is the honest floor.
    const joystickCount = sess?.joystick_count ?? 1;
    // The two identity lines, resolved once so the JSX below stays readable.
    // A device with no place (a legacy row) has no platform or tier to show —
    // it still renders the line, as a non-breaking space, because a tile with
    // one line fewer than its neighbours is the other way this grid goes ragged.
    // Split rather than one string: the tier is the half an operator scans for
    // ("is this the VIP one?"), and a long custom platform — "Table Tennis" —
    // would otherwise eat the ellipsis and take the tier down with it. The
    // platform shrinks; the tier never does.
    const platformName = pc.place ? platformLabel(pc.place.platform) : "";
    const tierName = pc.place ? pc.place.type : "";
    const nameLine =
      tr(pc.place, "name", lang).trim() || `№${pc.place?.number ?? tr(pc, "label", lang)}`;
    // Live state of the physical console behind this place, when one is bound.
    // Undefined covers both "this is a computer" and "the first probe has not
    // come back yet" — neither is something to show a colour for.
    const consoleState = pc.console_host_id ? consoleStatuses[pc.console_host_id]?.state : undefined;
    // What the panel is DOING about it, which is a different thing from what
    // the console said. "Waking…" is not a state a console reports; it is this
    // machine having sent a datagram and not been answered yet — and saying so
    // beats a stale "Rest" for the ten seconds in between.
    const consoleView = pc.console_host_id ? consoleViews[pc.console_host_id] : undefined;
    const lifecycle = consoleView?.snapshot.state;
    const consoleBusy = lifecycle === "WAKING" || lifecycle === "GOING_TO_REST"
      || lifecycle === "UNEXPECTED_WAKE" || lifecycle === "ERROR";
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
        {/* Line 1 — WHAT this seat is: platform and tier, the same
            "PS5 · STANDARD" wording the places board uses, so an operator
            reading both screens sees one vocabulary. The tier lives in
            `places.type` and was simply never rendered here; the board showed
            "PS5" and left standard and VIP indistinguishable.

            The agent dot keeps its place at the head of the line and is
            `flexShrink: 0`, so it cannot be squeezed out by a long label. */}
        <span className="platform" style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 18 }}>
          <span
            title={deviceStatus}
            style={{ width: 8, height: 8, borderRadius: 4, background: PC_STATUS_COLOR[deviceStatus], flexShrink: 0 }}
          />
          {/* Nested so the platform is the only thing that can shrink, and the
              4px gap reads as the single space in "PS5 · VIP". */}
          <span style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0 }}>
            <span className="cell-line" title={platformName || undefined}>{platformName || "\u00A0"}</span>
            {tierName && <span style={{ flexShrink: 0 }}>· {tierName}</span>}
          </span>
        </span>
        {/* The console itself, refreshed every ten seconds from this machine.
            On its OWN line, not beside the platform: a tile is 160px at its
            narrowest and "Режим покоя" next to "PS5 · STANDARD" does not fit in
            it — it pushed the line wider than the card.

            Deliberately a SECOND indicator rather than folded into the device
            dot above: that one is about the billing device and its kiosk agent,
            this one is about a box in the room, and a single dot meaning both
            would be unreadable the moment they disagreed. */}
        {consoleState && (
          <span
            className="ps5-chip"
            title={consoleBusy && lifecycle
              ? `${t("ps5.tile.bound")}: ${t(`ps5.lifecycle.${lifecycle}`)}${consoleView?.snapshot.error ? ` — ${t(`ps5.error.${consoleView.snapshot.error}`)}` : ""}`
              : `${t("ps5.tile.bound")}: ${t(PS5_STATE_LOOK[consoleState].key)}`}
          >
            <span
              className="ps5-chip__dot"
              style={{ background: lifecycle === "ERROR" ? "#ef4444" : PS5_STATE_LOOK[consoleState].dot }}
            />
            <span className="ps5-chip__text">
              {consoleBusy && lifecycle ? t(`ps5.lifecycle.${lifecycle}`) : t(PS5_STATE_LOOK[consoleState].key)}
            </span>
          </span>
        )}
        {/* Line 2 — WHICH seat it is. Its own line at the card's identity size,
            because a name an operator typed ("Плейстейшен 5 ВИП большое место")
            is what they actually look for, and sharing a wrapping flex row with
            the platform label is what pushed the status and the button down the
            card by a different amount on every tile. One line, ellipsis, and
            the full text on hover — the rule every other line here follows. */}
        <span className="id cell-line" title={nameLine}>{nameLine}</span>
        {sess ? (
          <>
            <span className="status" style={{ color }}>
              <SessionTimer
                endsAt={sess.ends_at}
                startedAt={sess.started_at}
                hourlyRate={sess.hourly_rate}
                isFree={sess.is_free}
                formatMoney={money}
              />
            </span>
            <span className="until">
              {/* The tariff line answers "what is this seat earning per hour",
                  and for a waived session the answer is not the venue's rate —
                  printing it there put a price the player will never be asked
                  for directly under a clock that was counting for free. */}
              {sess.is_free
                ? t("session.freeBill")
                : sess.is_unlimited
                  ? t("session.unlimited")
                  : sess.mode === "open"
                    ? `${money(Number(sess.hourly_rate ?? 0))} / ${t("time.hourShort") || "h"}`
                    : sess.package_name}
              {itemsCount > 0 && <span className="muted"> · {itemsCount} {t("session.posNote")}</span>}
            </span>
            {/* What the tile has to say at a glance and could not before: how
                many pads this seat is paying for, and whether it is paying at
                all. Both come from the server — the count is never derived
                here, or two cashiers would read different numbers off the same
                seat. The pads render only for a PlayStation, where the concept
                exists; a computer showing "🎮 1" would be noise. */}
            {(joystickCount > 1 || sess.is_free) && (
              <span className="row" style={{ gap: 6, fontSize: 12, flexWrap: "wrap" }}>
                {joystickCount > 1 && (
                  // One glyph as an icon plus the fraction, rather than one
                  // glyph per pad. Four glyphs is the widest this line could
                  // get on a 160px tile, and the repeat never said what the
                  // ceiling was — "3 / 4" answers "can another player join?"
                  // without opening anything. Same fraction the options dialog
                  // shows, so the two screens read identically.
                  <span title={`${t("session.joysticks")}: ${joystickCount} / ${MAX_JOYSTICKS}`}>
                    🎮 <span className="muted">{joystickCount} / {MAX_JOYSTICKS}</span>
                  </span>
                )}
                {sess.is_free && (
                  <span className="pill" style={{ fontSize: 10, letterSpacing: 0, textTransform: "none" }}>
                    {t("session.freeBillShort")}
                  </span>
                )}
              </span>
            )}
            <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => setAddItemTarget(sess)} style={miniBtnFlex}>{t("session.addItem")}</Button>
              <Button variant="secondary" onClick={() => setOptionsTarget(sess)} style={miniBtnFlex}>{t("session.optionsShort")}</Button>
              <Button variant="secondary" onClick={() => setStopTarget(sess)} style={miniBtnFlex}>{t("action.stop")}</Button>
            </div>
          </>
        ) : (
          <>
            {/* The platform used to be repeated here ("Свободно · PS5") because
                the header could not be trusted to show it. It has its own line
                now, with the tier, so the status says only what it is for: the
                state of the seat. */}
            <span className="status" style={{ color }}>
              {isOffline
                ? t("session.deviceOffline")
                : isReserved
                  ? t("session.reserved") || "Reserved"
                  : t("session.free")}
            </span>
            {isOffline && (
              <span className="until muted" style={{ fontSize: 11 }} title={t("session.deviceOfflineHint")}>
                {t("session.deviceOfflineHint")}
              </span>
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
          onStarted={() => {
            // The console may legitimately wake from now on. Said BEFORE the
            // reload, because the monitor can tick before the session row is
            // visible — and a monitor that sees "awake, no session" is a
            // monitor that switches the console off under the player.
            if (startTarget.console_host_id) sessionStarting(startTarget.id);
            setStartTarget(null);
            void sessions.reload();
            void pcs.reload();
          }}
        />
      )}
      {stopTarget && (
        <StopReceiptModal
          session={stopTarget}
          onClose={() => { setStopTarget(null); void sessions.reload(); void pcs.reload(); }}
          onConfirmed={() => {
            // The session is over on the backend, so the console should be
            // asleep. Whether this build can actually ask it to is the
            // transport's business — and its refusal is shown, not swallowed.
            const device = (pcs.data ?? []).find((pc) => pc.id === stopTarget.pc_id);
            if (device?.console_host_id) sessionStopped(device.id);
            void sessions.reload();
            void pcs.reload();
          }}
          onItemRemoved={() => { void sessions.reload(); }}
        />
      )}
      {optionsTarget && (
        <SessionOptionsDialog
          session={optionsTarget}
          platform={(pcs.data ?? []).find((pc) => pc.id === optionsTarget.pc_id)?.place?.platform}
          onClose={() => { setOptionsTarget(null); void sessions.reload(); }}
          // The server's answer replaces the dialog's copy AND the board's row,
          // so the tile behind the dialog is never a version behind it.
          onChanged={(updated) => { setOptionsTarget(updated); void sessions.reload(); }}
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
