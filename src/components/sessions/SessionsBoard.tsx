import { useAuth } from "@/auth/AuthContext";
import { tr } from "@/i18n/translated";
import { can } from "@/auth/permissions";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { GridSkeleton } from "@/components/ui/Skeleton";
import JoystickIcon from "@/components/ui/JoystickIcon";
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
import { useRealtimeResync } from "@/realtime/useRealtimeResync";
import { PS5_STATE_LOOK } from "@/ps5/stateLook";
import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AddSessionItemDialog from "./AddSessionItemDialog";
import SessionTimer from "./SessionTimer";
import { sessionJoysticksTotal } from "./sessionAmount";
import StartSessionDialog from "./StartSessionDialog";
import SessionOptionsDialog from "./SessionOptionsDialog";
import { MAX_JOYSTICKS } from "@/api/joystickPrices";
import { notify } from "@/ui/notify";
import StopReceiptModal from "./StopReceiptModal";
import { useExpiryNudge } from "./useExpiryNudge";

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
  // The session whose pads are mid-change. One at a time and per session, so a
  // second click on the SAME tile is refused while the first is in flight and a
  // cashier working another seat is not blocked by it.
  //
  // Not the only guard: the server takes a row lock on the session and refuses
  // a removal of a pad that is already gone. This one keeps the operator from
  // sending the second request at all.
  const [padBusy, setPadBusy] = useState<number | null>(null);
  // The last refusal, shown on the tile it belongs to. This project has no
  // global toast helper and the board shows its errors where they happened;
  // keyed by session so one seat's refusal does not appear on another's.
  const [padError, setPadError] = useState<{ id: number; message: string } | null>(null);
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

  /**
   * A seat changed hands for a reason that is NOT a session — a reservation
   * created, cancelled or expired.
   *
   * ⚠️ Session-driven reasons are dropped here on purpose. The backend now
   * announces both events for one change (`SessionBroadcaster` fires the
   * players' `PlaceAvailabilityChanged` beside the staff `SessionChanged`), and
   * this board is subscribed to both — so a single "+10 minutes" produced three
   * GETs per open panel: one from the handler below and two from this one.
   *
   * `session.*` is already covered, with a richer payload, by
   * `useSessionChanged` underneath. What only reaches the board through THIS
   * event is the booking side, and that is what it is kept for.
   */
  usePlaceAvailability(
    branchId,
    useCallback(
      (evt) => {
        if ((evt.reason ?? "").startsWith("session.")) return;
        void sessions.reload();
        void pcs.reload();
      },
      [sessions, pcs],
    ),
  );

  // A session's TERMS changed on another machine — a pad in or out, time
  // granted, the ceiling lifted, the bill waived. Without this the second
  // cashier's board found out on its next 30-second poll, which is half a
  // minute of two people acting on different numbers over the same till.
  //
  // It also carries the one change nobody made: a seat whose paid period ran
  // out and which the server ended by itself. `kind` is `stopped` for that as
  // well — what tells the two apart is `status`, which is `expired` when the
  // clock ended it and `stopped` when a person did. Only the first opens a
  // receipt: a modal appearing on every desk each time a colleague presses Stop
  // would be noise, whereas a seat that ended on its own is money somebody has
  // to go and collect, and nothing else would say so.
  useSessionChanged(
    branchId,
    useCallback((evt) => {
      if (evt.kind === "stopped" && evt.status === "expired") {
        const ended = (sessions.data ?? []).find((s) => s.id === evt.session_id);
        // Never over the top of an open receipt: a cashier mid-checkout on one
        // seat must not have it replaced by another. The second seat is still
        // ended and still on the board's history — what it loses is the popup.
        if (ended) setStopTarget((current) => current ?? { ...ended, status: "expired" });
      }
      void sessions.reload();

      // A MOVE changed two device rows as well as the session — the seat left
      // behind went back to Online and the one taken went In Session. The
      // session list alone would move the tile but leave both devices reading
      // their old status, which is what the board colours "offline" and
      // "startable" from. Only this kind needs it; every other change touches
      // the session and nothing else.
      if (evt.kind === "moved") {
        void pcs.reload();
      }
    }, [sessions, pcs]),
  );

  /**
   * The self-healing poll — the only thing that puts this board right when a
   * socket frame never arrives.
   *
   * ⚠️ It is armed ONCE, through a ref, and that is the entire point.
   * `useAsync` returns `{ ...state, reload }` — a new object on every render —
   * so an effect keyed on `[sessions, pcs]` cleared and restarted this
   * interval every time anything re-rendered the board. `usePs5Control()`
   * above re-renders it every ten seconds at a venue with a console bound
   * (`useConsoleWatch`'s `WATCH_INTERVAL_MS`), so the thirty seconds were
   * never reached and the poll had, in practice, never once fired.
   *
   * That left the board with no fallback at all: a missed `session.changed`
   * stayed missed, and `useExpiryNudge` cannot cover it because it only looks
   * at sessions that HAVE an end — an unlimited or count-up seat is exactly
   * the one it filters out.
   */
  /**
   * A dropped socket means everything broadcast during the gap is gone — a
   * stop, a grant, a pad — and resuming the subscription does not bring it
   * back. Re-read once when the connection returns.
   *
   * The poll below would eventually repair it too, but "eventually" is up to
   * thirty seconds of a cashier looking at a seat that is already free, and it
   * is the poll that this board went without for so long.
   */
  useRealtimeResync(
    useCallback(() => {
      void sessions.reload();
      void pcs.reload();
    }, [sessions, pcs]),
  );

  const reloadBoardRef = useRef(() => {
    void sessions.reload();
    void pcs.reload();
  });
  reloadBoardRef.current = () => {
    void sessions.reload();
    void pcs.reload();
  };

  useEffect(() => {
    const t = setInterval(() => reloadBoardRef.current(), 30_000);
    return () => clearInterval(t);
  }, []);

  /**
   * Add or remove one pad on this seat, from the tile.
   *
   * The SAME endpoints the options dialog calls — there is one way to change a
   * session's pads and this is a second door to it, not a second implementation.
   * Removal names the highest slot in play, which is the pad a "−" means: the
   * last one handed out.
   *
   * The server decides everything that matters — the price, whether the period
   * falls inside the grace window, whether the seat may have pads at all — and
   * the board simply re-reads afterwards.
   */
  const changePads = useCallback(async (sess: ISessionApi, action: "add" | "remove") => {
    if (padBusy !== null) return;
    setPadBusy(sess.id);
    setPadError(null);
    try {
      // The SERVER's answer, and the count is read off it rather than adding
      // or subtracting one here — a tile that predicted the number would show
      // a figure the server had not agreed to, on the one operation where
      // another cashier may have moved it first.
      const updated = action === "add"
        ? await sessionRepository.addJoystick(sess.id)
        : await (async () => {
          const open = (sess.joysticks ?? []).filter((j) => j.stopped_at === null);
          const slot = open.length > 0 ? Math.max(...open.map((j) => j.slot)) : null;
          if (slot === null) return null;
          return sessionRepository.removeJoystick(sess.id, slot);
        })();

      if (updated === null) return;

      // Only now, and only for the operation that actually landed. A refusal
      // throws and is caught below, where it becomes the tile's error line.
      const count = updated.joystick_count ?? sess.joystick_count ?? 1;
      notify.message(
        action === "add" ? "success" : "error",
        `${t(action === "add" ? "session.joystickAdded" : "session.joystickRemoved")} · `
        + `${t("session.joysticksInSession")} ${count} / ${MAX_JOYSTICKS}`,
      );

      await sessions.reload();
    } catch (e) {
      // Shown, never swallowed: the refusals here are sentences a cashier has
      // to read. No price set for that slot, four pads already in play, the
      // session no longer active.
      setPadError({ id: sess.id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setPadBusy(null);
    }
  }, [padBusy, sessions, t]);

  // …and one wake-up aimed at the exact instant the soonest seat runs out.
  //
  // The server's expiry is exact but rides a request: with the thirty-second
  // poll above as the only carrier, a tile's countdown reached 00:00 and the
  // seat stayed busy for the rest of the interval. This asks at the deadline
  // instead of waiting for the next tick — the server still decides, and the
  // same read returns the board without the seat on it.
  useExpiryNudge(
    sessions.data,
    useCallback(() => {
      void sessions.reload();
      void pcs.reload();
    }, [sessions, pcs]),
  );

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
    // The backend's answer, resolved from the place's platform. Absent on an
    // older payload, and then the controls simply are not drawn — which is the
    // safe direction: a missing field must not offer an operation the seat
    // cannot take.
    const supportsJoysticks = sess?.supports_joysticks === true;
    // The two ends of the range, named once. The ceiling is the server's own
    // limit; the floor is slot 1 — the session's own controller, which is not
    // an extra, has no row, and cannot be handed back.
    //
    // A button at its end is REMOVED, not disabled. On a 22px control a
    // disabled state is a shade of grey an operator has to compare against its
    // neighbour to read, and "why can I not press this" is a worse question
    // than "there is nothing to press". Both ends are enforced on the server
    // too — this decides what is drawn, never what is allowed.
    const atCeiling = joystickCount >= MAX_JOYSTICKS;
    const atFloor = joystickCount <= 1;
    // The pad line: how many periods were charged, at what fee, for how much.
    // Null when nothing was, and null on a waived seat — a fee printed under
    // "Бесплатная сессия" is the same two-numbers-one-truth problem the rate
    // and the time cost had on the receipt.
    //
    // `each` is only shown when every charged period agrees on a price. They
    // can differ: the fee is frozen when a pad goes out, so a seat that
    // straddles a re-pricing holds two. "3 × ?" would be a lie; the sum is
    // always true, so the line falls back to it.
    const padCharge = ((): { count: number; each: number | null; total: number } | null => {
      if (sess === undefined || sess.is_free) return null;
      const charged = (sess.joysticks ?? []).filter((j) => j.is_charged);
      if (charged.length === 0) return null;
      const first = Number(charged[0].price);
      const uniform = charged.every((j) => Number(j.price) === first);
      return { count: charged.length, each: uniform ? first : null, total: sessionJoysticksTotal(sess) };
    })();
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
              {/* The row itself, not a handful of its fields. Passing an
                  hourly rate a fixed session does not have is what left the
                  countdown branch with nothing to price from. */}
              <SessionTimer session={sess} formatMoney={money} />
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
            {(joystickCount > 1 || supportsJoysticks || sess.is_free) && (
              <span className="row" style={{ gap: 6, fontSize: 12, flexWrap: "wrap" }}>
                {/* Pads are a PlayStation thing, and the seat says so itself:
                    `supports_joysticks` is the backend's answer — the place's
                    platform where the seat has a place, the device's own kind
                    where it has none. Never the label: "PS4-08" is a name
                    somebody typed, and a venue that renames a seat would lose
                    its controls.

                    Shown for every PlayStation seat, not only one that already
                    has a second pad: a control that appears once you have
                    already used it is a control nobody finds. */}
                <span className="row" style={{ gap: 4, alignItems: "center" }}>
                  {/* The count, with the icon and the word in front of it.
                      Before this it appeared only from the SECOND pad onwards,
                      so a seat that had just started showed two unlabelled 20px
                      buttons and nothing to say what they were for — which is
                      how a feature that was fully built read as missing.

                      One glyph plus the fraction, not one glyph per pad. Four
                      glyphs is the widest this line could get on a 160px tile,
                      and the repeat never said what the ceiling was — "1 / 4"
                      answers "can another player join?" without opening
                      anything.

                      `joystickCount` counts the pads IN PLAY and the session's
                      own is one of them, so a fresh seat reads 1 / 4, not 0.
                      That is the same number the options dialog shows for the
                      same seat, and two screens disagreeing about one seat is
                      worse than either wording. */}
                  {(supportsJoysticks || joystickCount > 1) && (
                    <span
                      className="row"
                      style={{ gap: 4, alignItems: "center" }}
                      title={`${t("session.joysticks")}: ${joystickCount} / ${MAX_JOYSTICKS}`}
                    >
                      <JoystickIcon />
                      <span className="muted">{joystickCount} / {MAX_JOYSTICKS}</span>
                    </span>
                  )}
                  {supportsJoysticks && (
                  <>
                    {/* Gone at the floor, not greyed out. One pad in play is
                        the session's own and there is no row to take back. */}
                    {!atFloor && (
                      <button
                        type="button"
                        style={padBtn}
                        title={t("session.joystickRemoveHere")}
                        aria-label={t("session.joystickRemoveHere")}
                        // `busy` is what stops a double-click becoming two
                        // removals before the board has heard about the first.
                        // It is the only reason either button is ever disabled
                        // rather than absent: the operation is legal, it is
                        // simply already in flight.
                        disabled={padBusy === sess.id}
                        onClick={() => void changePads(sess, "remove")}
                      >
                        −
                      </button>
                    )}
                    {/* …and gone at the ceiling. The count beside it already
                        says 4 / 4, which is the answer a missing button would
                        otherwise leave the operator looking for. */}
                    {!atCeiling && (
                      <button
                        type="button"
                        style={padBtn}
                        title={t("session.joystickAddHere")}
                        aria-label={t("session.joystickAddHere")}
                        disabled={padBusy === sess.id}
                        onClick={() => void changePads(sess, "add")}
                      >
                        +
                      </button>
                    )}
                    {/* The round trip, said on the tile it belongs to. Both
                        buttons are already disabled while it is in flight; this
                        is what tells the cashier the click landed, on a board
                        where the number itself only moves once the server has
                        answered. */}
                    {padBusy === sess.id && (
                      // The project's own spinner class, sized down inline
                      // rather than by widening the `Spinner` primitive: that
                      // one is a 32px page-level element with its own margins,
                      // and giving it a props API for one 12px use would change
                      // a component every screen renders.
                      <span
                        className="spinner"
                        style={{ width: 12, height: 12, borderWidth: 2, margin: 0 }}
                        aria-hidden="true"
                      />
                    )}
                  </>
                  )}
                </span>
                {/* What the pads have added to this seat, spelled out.
                    Before this the fee vanished into the running total and a
                    cashier had no way to see it was there — which is the
                    question a player asks when the figure jumps by 300.

                    A count and a flat fee, never a rate: it does not move with
                    the clock and re-renders every second without changing.
                    Both figures come from the server's own rows — the count of
                    CHARGED periods, which is not the count of pads in play,
                    because a pad handed back keeps its fee. */}
                {padCharge !== null && (
                  <span className="muted" style={{ fontSize: 11, flexBasis: "100%" }}>
                    {t("session.joysticksCost")}:{" "}
                    {padCharge.each !== null && `${padCharge.count} × ${money(padCharge.each)} = `}
                    {money(padCharge.total)}
                  </span>
                )}
                {padError?.id === sess.id && (
                  <span className="error" style={{ fontSize: 11, flexBasis: "100%" }}>
                    {padError.message}
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
              {/* Named for the thing a cashier is actually looking for on a
                  seat that is running out. It opens the SAME dialog "Options"
                  does — one management surface, reached by two names, because
                  "Options" is not what somebody with eight minutes left is
                  scanning the card for.

                  Only on a seat that HAS an end: a count-up or unlimited
                  session has nothing to extend, and the dialog says so rather
                  than offering it. */}
              {sess.ends_at !== null && sess.is_unlimited !== true && (
                <Button variant="secondary" onClick={() => setOptionsTarget(sess)} style={miniBtnFlex}>{t("session.addTime")}</Button>
              )}
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

/** A 20px square that reads as a control without competing with the tile. */
/**
 * The pad buttons on a tile.
 *
 * They were 20px, transparent, and outlined in #1f2a44 — the tile's own border
 * colour — with no label or icon beside them. On a dark card that is a control
 * an operator has to already know is there, which is half of why a shipped
 * feature was reported as missing. Filled, a shade lighter than the card, and
 * 22px so the glyph has room: still small enough to sit on a 160px tile beside
 * the count without wrapping.
 */
const padBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  lineHeight: 1,
  padding: 0,
  borderRadius: 5,
  border: "1px solid #2c3b5e",
  background: "#131c31",
  color: "#cfe0f5",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const miniBtnFlex: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  flex: "1 0 auto",
  minWidth: 0,
};

export default SessionsBoard;
