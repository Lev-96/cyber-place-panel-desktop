import { preciseWhenSmall } from "@/i18n/currency";
import { useAuth } from "@/auth/AuthContext";
import { tr } from "@/i18n/translated";
import { can } from "@/auth/permissions";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { ErrorState, StaleNotice, StateView } from "@/components/ui/state";
import { reconcileOrder } from "./tileOrder";
import { useAsync } from "@/hooks/useAsync";
import { useBranchPlatformNames } from "@/hooks/useBranchPlatforms";
import { useKeyedBusy } from "@/hooks/useKeyedBusy";
import { useLocalReorder } from "@/hooks/useLocalReorder";
import { useReservedPlaceIds } from "@/hooks/useReservedPlaceIds";
import { useReservationsByPlace } from "@/hooks/useReservationsByPlace";
import BookingsCalendarModal from "@/components/reservations/BookingsCalendarModal";
import ReservationActions from "./ReservationActions";
import { useLang } from "@/i18n/LanguageContext";
import { fmt } from "@/i18n/translations";
import { usePlaceAvailability } from "@/realtime/usePlaceAvailability";
import { useSessionChanged } from "@/realtime/useSessionChanged";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PAD_CEILING_FALLBACK, padCeiling, padChargeOf, padChoices, padIdentity } from "./joystickView";
import { effectivePcStatus, isPs } from "@/types/pc";
import {
  canStartSession,
  resolveSessionCellState,
  SESSION_CELL_COLOR,
} from "@/domain/SessionCellState";
import { platformGroup } from "@/utils/platform";
import { usePs5Control } from "@/ps5/Ps5ControlProvider";
import { useRealtimeResync } from "@/realtime/useRealtimeResync";
import { PS5_STATE_LOOK } from "@/ps5/stateLook";
import { startGate, stopGate } from "@/ps5/tileGate";
import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AddSessionItemDialog from "./AddSessionItemDialog";
import SellProductsDialog from "@/components/pos/SellProductsDialog";
import { durationLabel } from "@/components/prices/vipMinimumCharge";
import SessionTimer from "./SessionTimer";
import ResetTimeDialog from "./ResetTimeDialog";
import { autoResumeAtOf, sessionCurrentHourlyRate, sessionJoysticksTotal } from "./sessionAmount";
import StartSessionDialog from "./StartSessionDialog";
import SessionOptionsDialog from "./SessionOptionsDialog";
import SessionCard, { CardFootAction, CardOverflow, SessionCardAction } from "./SessionCard";
import { freeUntilOf, reservationTip, reservationWindow } from "./reservationText";
import { PAD_COUNT_STYLE, PAD_LINE_STYLE, SeatGrip, SeatNameLine, SeatPlatformLine, sessionTariffLine } from "./seatParts";
import SimpleBoardHelp from "./SimpleBoardHelp";
import { useUiPreferencesOptional } from "@/preferences/UiPreferencesContext";
import RelocateSessionDialog from "./RelocateSessionDialog";
import { BASE_JOYSTICKS, MAX_JOYSTICKS } from "@/api/joystickPrices";
import { notify } from "@/ui/notify";
import StopReceiptModal from "./StopReceiptModal";
import UnpaidAlert, { type UnpaidNotice } from "./UnpaidAlert";
import { playFor } from "@/sound/soundEngine";
import PadToggle from "./PadToggle";
import PadChargeNote from "./PadChargeNote";
import FeeSentence from "./FeeSentence";
import { outsideFoodFeeOf, productLineCount } from "./outsideFood";
import { useTransientFlags } from "@/hooks/useTransientFlags";
import { useExpiryNudge } from "./useExpiryNudge";
import { dropSideOf, moveOnto } from "@/utils/reorder";

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
  // How the person's interface lays the card's actions out (2026-10-27);
  // outside the provider (tests, an embed) every action is shown, as before.
  const uiLayout = useUiPreferencesOptional()?.layout;
  const quickActions = uiLayout?.quick_actions ?? "all";
  const density = uiLayout?.density ?? "standard";
  const pcs = useAsync(() => sessionRepository.listPcs(branchId), [branchId]);
  // Custom platforms named as the branch named them, in the panel language.
  // ONE cached read for the board and every dialog it opens (passed down), and
  // best effort: until it lands, or if it fails, names fall back to the slug.
  const { nameOf: platformName } = useBranchPlatformNames(branchId);
  const sessions = useAsync(() => sessionRepository.listActive(branchId), [branchId]);
  const [startTarget, setStartTarget] = useState<IPcApi | null>(null);
  // «Пришёл» (2026-11-07): the reservation the start fulfils.
  const [startBookingId, setStartBookingId] = useState<number | undefined>(undefined);
  // «Забронировать» on a free seat (2026-11-07).
  // The bookings calendar (2026-11-07, owner): the card's «Забронировать»
  // opens it on that seat and today; the header's «Календарь броней» on all.
  const [calendar, setCalendar] = useState<{ focusPlaceId?: number } | null>(null);
  const [stopTarget, setStopTarget] = useState<ISessionApi | null>(null);
  const [addItemTarget, setAddItemTarget] = useState<ISessionApi | null>(null);
  // The till's sale, opened from the board's header (2026-10-25).
  const [sellOpen, setSellOpen] = useState(false);
  /** The line a return is in flight for, so its button cannot be pressed twice. */
  const [returningItem, setReturningItem] = useState<number | null>(null);
  /**
   * The seats a hand-out is in flight for — per seat, so a double press on one
   * is one thing and a press on another still goes through (useKeyedBusy).
   */
  const extraBusy = useKeyedBusy();

  /**
   * The room's extra that is still OUT, if any — hourly or fixed.
   *
   * A pad answers this from its own row (`stopped_at`), and so does this: an
   * `is_extra` line with no `returned_at` is still with the player. The FIRST
   * one is the one the button hands back, the way the pad control takes the
   * top pad — one press, one thing, no menu.
   *
   * ⚠️ Deliberately NOT gated on `is_hourly`. It was, back when handing
   * something back meant stopping a charge; it means "the thing came back"
   * now, which is as true of chips sold at a flat price as of a rented cue.
   */
  const openExtra = (sess: ISessionApi) =>
    (sess.items ?? []).find((i) => i.is_extra && !i.returned_at) ?? null;

  /**
   * Put the bill lines a hand-out or a return just answered with on the tile
   * NOW, so the button flips on the press instead of a board read later.
   *
   * ONLY `items`: those two endpoints load nothing else, so the rest of their
   * session is partial — no `pc`, so no `extra_item`, and taking it whole
   * would blank the very button it is meant to flip. The lines are the same
   * shape the board list sends. The `reload()` that always follows brings
   * everything else back, and the server's own word on the lines too.
   */
  const applyItems = (updated: ISessionApi) => {
    if (!Array.isArray(updated.items)) return;
    sessions.mutate((list) =>
      list?.map((s) => (s.id === updated.id
        ? {
          ...s,
          items: updated.items,
          // …and the button's own state when the answer carries it (a server
          // from 2026-09-23 on loads the seat's place for exactly this), so a
          // fixed room greys its button on the press. Absent, the board's
          // copy stands until the reload.
          ...(updated.extra_item !== undefined ? { extra_item: updated.extra_item } : {}),
        }
        : s)) ?? list);
  };

  /**
   * Hand ONE over. One press, one thing, no menu — the pad control's own
   * shape, for the pad control's own reason.
   *
   * A FIXED extra simply puts its price on the bill. An HOURLY one starts its
   * rate: the tile's tariff goes from 1 000/h to 1 500/h the moment the chips
   * go out, and `returnExtra` below stops it again. The count that used to be
   * asked for in a dialog was a question nobody at the counter asks about a
   * controller, and it is not one they ask about chips either.
   *
   * The name and the price are the ROOM's — the write carries `extra: true`
   * and a count of one, and the server prices it. That is also what lets a
   * manager hand one out: a typed price needs `products.manage`.
   */
  const handOutExtra = async (sess: ISessionApi) => {
    if (!extraBusy.begin(sess.id)) return;

    setPadError(null);
    try {
      applyItems(await sessionRepository.addItems(sess.id, [{ extra: true, qty: 1 }]));
      // Green, naming the thing in the room's word — the pads' own toast
      // after a hand-out. Only after the server accepted it: a refusal stays
      // on the tile below and says why.
      notify.message("success", fmt(t("session.extraAdded"), sess.extra_item?.name ?? ""));
    } catch (e) {
      // On the tile it belongs to, like every other refusal here: no price
      // set, nothing left to hand out, the session is over.
      setPadError({ id: sess.id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      extraBusy.end(sess.id);
      await sessions.reload();
    }
  };

  /**
   * Hand it back. The charge it earned stays on the bill, exactly as a
   * returned pad's does. The tile takes the server's answer at once and the
   * board re-reads afterwards — it never patches a figure it computed.
   */
  const returnExtra = async (sess: ISessionApi, itemId: number) => {
    setPadError(null);
    setReturningItem(itemId);
    try {
      applyItems(await sessionRepository.returnItem(sess.id, itemId));
      // Red, as a pad's removal toast is, naming the thing in the room's
      // word. Only once the server took it back.
      notify.message("error", fmt(t("session.extraReturnedToast"), sess.extra_item?.name ?? ""));
    } catch (e) {
      // Shown on the tile it belongs to, like every other refusal here: this
      // project has no global toast.
      setPadError({ id: sess.id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setReturningItem(null);
      await sessions.reload();
    }
  };
  /**
   * The seat as a toast names it: `№{place.number ?? place.id}`, which is what
   * its tile and the player's phone show, or the device's label when it has
   * no place. Read from the board's own device list at the moment of the toast.
   */
  const seatOf = (pcId: number): string => {
    const pc = (pcs.data ?? []).find((p) => p.id === pcId);
    if (!pc) return "";
    return pc.place ? `№${pc.place.number ?? pc.place.id}` : tr(pc, "label", lang);
  };

  /**
   * The seats a pause or resume is in flight for. Per seat, and ref-backed
   * inside useKeyedBusy: two clicks landing before the re-render that greys
   * the button are still one request (the server would refuse the second with
   * a 409 — this keeps it from leaving), while another seat is never blocked.
   */
  const pauseBusy = useKeyedBusy();
  /** A refused pause/resume, on the tile it belongs to — every kind of seat. */
  const [pauseError, setPauseError] = useState<{ id: number; message: string } | null>(null);

  /**
   * Stop or restart the seat's clock. The SERVER decides and answers with the
   * row; the tile takes its pause fields at once — so the clock freezes on
   * the press — and then re-reads the board as every action here does. Only
   * those fields, because the answer is the server's own and the rest of the
   * row the reload brings back. A wrong state (another cashier paused it a
   * second earlier, or stopped it) comes back as a sentence and is shown.
   */
  /**
   * A session moved seats: the console it left is stopped, the one it went to
   * is starting — told BEFORE the reload, for the reason Start gives below
   * (a monitor seeing "awake, no session" switches the console off under the
   * player). Only for consoles; a no-op when the seat did not change.
   */
  const consolesFollowMove = (fromPcId: number, toPcId: number) => {
    if (fromPcId === toPcId) return;
    const devices = pcs.data ?? [];
    const from = devices.find((pc) => pc.id === fromPcId);
    const to = devices.find((pc) => pc.id === toPcId);
    if (from?.console_host_id) sessionStopped(from.id);
    if (to?.console_host_id) sessionStarting(to.id);
  };

  /**
   * Seats that ended owing for extra time (2026-11-07): rung once each and
   * queued, so two seats ending together are two warnings, never one lost.
   * Fed by the `stopped` broadcast (an auto-expiry, another desk) AND by this
   * desk's own Stop answer — whichever lands first; the session id dedupes.
   */
  const [unpaidNotices, setUnpaidNotices] = useState<UnpaidNotice[]>([]);
  const noticeUnpaid = useCallback((sessionId: number, pcId: number, amount: number | null | undefined) => {
    if (amount === null || amount === undefined || !(amount > 0)) return;
    setUnpaidNotices((list) => {
      if (list.some((n) => n.sessionId === sessionId)) return list;
      playFor("session_unpaid", `unpaid-${sessionId}`);
      return [...list, { sessionId, seat: seatOf(pcId), amount }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcs.data]);
  const togglePause = async (sess: ISessionApi) => {
    if (!pauseBusy.begin(sess.id)) return;

    setPauseError(null);
    try {
      const resuming = !!sess.paused_at;
      const updated = resuming
        ? await sessionRepository.resume(sess.id)
        : await sessionRepository.pause(sess.id);
      sessions.mutate((list) =>
        list?.map((s) => (s.id === updated.id
          ? { ...s, paused_at: updated.paused_at ?? null, pauses: updated.pauses ?? s.pauses, ends_at: updated.ends_at }
          : s)) ?? list);
      // Only after the server accepted it: a refusal stays on the tile below.
      // Amber for a pause (the clock is waiting on somebody), green for the
      // clock running again.
      notify.message(
        resuming ? "success" : "warning",
        fmt(t(resuming ? "session.toastResumed" : "session.toastPaused"), seatOf(sess.pc_id)),
      );
    } catch (e) {
      setPauseError({ id: sess.id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      pauseBusy.end(sess.id);
      await sessions.reload();
    }
  };
  const [optionsTarget, setOptionsTarget] = useState<ISessionApi | null>(null);
  // The session being moved to another seat («Переместить игрока»).
  const [relocateTarget, setRelocateTarget] = useState<ISessionApi | null>(null);
  // "Reset the counter" (2026-11-05): the session being asked about, by id —
  // the dialog always reads its LIVE row, so a reset, +time or stop from
  // another desk while it is open is what it shows (and what the toast counts).
  const [resetId, setResetId] = useState<number | null>(null);
  const resetTarget = resetId === null ? null : (sessions.data ?? []).find((s) => s.id === resetId) ?? null;
  // Gone from the board, or no longer running: nothing left to reset.
  useEffect(() => {
    if (resetId !== null && (resetTarget === null || resetTarget.status !== "active")) setResetId(null);
  }, [resetId, resetTarget]);
  const mayReset = can(role, "session.free");
  // The sessions whose pads are mid-change. Per session (useKeyedBusy), so a
  // second click on the SAME tile is refused while the first is in flight and a
  // cashier working another seat is not blocked by it — which is what the old
  // single `number | null` promised here and did not do.
  //
  // Not the only guard: the server takes a row lock on the session and refuses
  // a removal of a pad that is already gone. This one keeps the operator from
  // sending the second request at all.
  const padBusy = useKeyedBusy();
  // Which seats' last pad press is being said beside the card (5s, owner
  // 2026-11-04): only for the cashier who pressed, never from a socket update.
  const padNotes = useTransientFlags<number>(5000);
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
  const reservations = useReservationsByPlace(branchId, reservedPlaceIds);

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
      // Ended owing for extra time — by itself or at any desk (2026-11-07).
      if (evt.kind === "stopped") noticeUnpaid(evt.session_id, evt.pc_id, evt.unpaid_amount);
      if (evt.kind === "stopped" && evt.status === "expired") {
        const ended = (sessions.data ?? []).find((s) => s.id === evt.session_id);
        // Never over the top of an open receipt: a cashier mid-checkout on one
        // seat must not have it replaced by another. The second seat is still
        // ended and still on the board's history — what it loses is the popup.
        if (ended) setStopTarget((current) => current ?? { ...ended, status: "expired" });
      }
      // The receipt open on THIS seat, ended elsewhere (another cashier, the
      // clock) while it was on screen (2026-10-25): it turns into that final
      // bill, with no confirm — never a second "stopped" announced as ours.
      if (evt.kind === "stopped") {
        setStopTarget((current) => (current && current.id === evt.session_id && current.status === "active"
          ? { ...current, status: (evt.status ?? "stopped") as ISessionApi["status"] }
          : current));
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
  /**
   * Set the number of pads in play to `target`, using the SAME add and remove
   * operations the buttons used.
   *
   * The select says how many there should be; the difference is turned into
   * that many calls to the existing endpoints. Nothing about how a pad is
   * priced changed — a fee is charged when one is added and is not refunded
   * when it goes, which is why "how many are active" and "how many were
   * charged" are different numbers and only the first is what this control
   * sets.
   *
   * ⚠️ Removals read the open slots from the LAST answer, not from the row the
   * board rendered: taking two pads back is two calls, and the second must
   * remove the slot that is still open after the first.
   */
  /**
   * Hand ONE pad over, the one the cashier named.
   *
   * It was a target count and a loop: going from one pad to three made two
   * calls and the server picked both slots. That could not survive a venue
   * pricing the third and the fourth apart, because "add two" no longer says
   * what it costs. One press is now one pad, named, and the server agrees or
   * refuses — it never takes the price from here.
   */
  const addPad = useCallback(async (sess: ISessionApi, slot: number) => {
    if (!padBusy.begin(sess.id)) return;

    setPadError(null);
    let accepted = false;

    try {
      const updated = await sessionRepository.addJoystick(sess.id, slot);
      // The server's own count, never one predicted here: another cashier may
      // have moved this seat first, and a tile showing a number the server has
      // not agreed to is how two screens start disagreeing about one seat.
      const count = updated.joystick_count ?? (sess.joystick_count ?? 1);
      accepted = true;
      notify.message(
        "success",
        `${t("session.joystickAdded")} · ${t("session.joysticksInSession")} `
        + `${count} / ${padCeiling(updated) ?? padCeiling(sess) ?? MAX_JOYSTICKS}`,
      );
    } catch (e) {
      // Shown, never swallowed: the refusals here are sentences a cashier has
      // to read. This branch does not hand out that pad, it is already in play,
      // another one comes first, no price is set, the session is over.
      setPadError({ id: sess.id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      padBusy.end(sess.id);
      await sessions.reload();
      // After the read-back, so the note says what the server now holds.
      if (accepted) padNotes.flash(sess.id);
    }
  }, [padBusy, padNotes, sessions, t]);

  /**
   * Take the last pad handed out back.
   *
   * The highest OPEN slot, which is the pad that went out most recently — the
   * same rule the count select used, kept because it is the one the floor
   * expects: a player gets up, the controller that comes back is theirs.
   *
   * Removal is NOT a refund under either strategy, and nothing here pretends
   * otherwise: the fixed fee stays on the bill and the hourly meter simply
   * stops. That is the server's rule and this only asks for it.
   */
  const removeTopPad = useCallback(async (sess: ISessionApi) => {
    const open = (sess.joysticks ?? []).filter((j) => j.stopped_at === null);
    if (open.length === 0) return;
    const slot = Math.max(...open.map((j) => j.slot));

    if (!padBusy.begin(sess.id)) return;
    setPadError(null);
    let accepted = false;

    try {
      const updated = await sessionRepository.removeJoystick(sess.id, slot);
      const count = updated.joystick_count ?? (sess.joystick_count ?? 1);
      accepted = true;
      notify.message(
        "error",
        `${t("session.joystickRemoved")} · ${t("session.joysticksInSession")} `
        + `${count} / ${padCeiling(updated) ?? padCeiling(sess) ?? MAX_JOYSTICKS}`,
      );
    } catch (e) {
      setPadError({ id: sess.id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      padBusy.end(sess.id);
      await sessions.reload();
      if (accepted) padNotes.flash(sess.id);
    }
  }, [padBusy, padNotes, sessions, t]);

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
    setOrder((prev) => reconcileOrder(prev, ids));
  }, [pcs.data]);

  const sessionByPc = new Map<number, ISessionApi>();
  for (const s of sessions.data ?? []) sessionByPc.set(s.pc_id, s);

  const byId = new Map((pcs.data ?? []).map((p) => [p.id, p] as const));
  // Reconciled during render too: `order` catches up only after paint, and the
  // tiles must not wait for it (see tileOrder.ts).
  const orderedPcs = reconcileOrder(order, (pcs.data ?? []).map((p) => p.id))
    .map((id) => byId.get(id))
    .filter((p): p is IPcApi => !!p);

  // Seats with a session running on them, counted off the SAME map the tiles
  // are drawn from — so the heading and the grid cannot disagree about how
  // many are in use. Not `sessions.data.length`: a session whose device is not
  // on this board would inflate it.
  const occupiedCount = orderedPcs.reduce((n, pc) => n + (sessionByPc.has(pc.id) ? 1 : 0), 0);

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
    key === "pc" ? t("session.groupComputers") : key === "ps" ? t("session.groupPs") : platformName(key);

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
      const next = moveOnto(prev, from, targetId);
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
    // Free now, reserved later (2026-11-07, owner): how long a walk-in may
    // play, from the server's next booking start. Since 2026-11-08 it also
    // paints the card in the reservation yellow (SessionCard `bookingAhead`).
    const freeUntil = !sess && !isOffline && !isReserved ? freeUntilOf(pc.next_booking_start) : null;
    const deviceStatus = effectivePcStatus(pc);
    const color = SESSION_CELL_COLOR[cellState];
    // Products only: the own-food fee (2026-11-13) is a line too, but it is
    // not something sold, and the card names it on its own line below.
    const itemsCount = productLineCount(sess?.items);
    const foodFee = outsideFoodFeeOf(sess?.items);
    // The backend's answer, resolved from the place's platform. Absent on an
    // older payload, and then the controls simply are not drawn — which is the
    // safe direction: a missing field must not offer an operation the seat
    // cannot take.
    const supportsJoysticks = sess?.supports_joysticks === true;
    // The pad line: how many periods were charged, at what fee, for how much.
    // Null when nothing was, and null on a waived seat — a fee printed under
    // "Бесплатная сессия" is the same two-numbers-one-truth problem the rate
    // and the time cost had on the receipt.
    //
    // `each` is only shown when every charged period agrees on a price. They
    // can differ: the fee is frozen when a pad goes out, so a seat that
    // straddles a re-pricing holds two. "3 × ?" would be a lie; the sum is
    // always true, so the line falls back to it.
    const padCharge = sess === undefined ? null : padChargeOf(sess);

    // What the seat costs an hour right now. Only shown under the hourly
    // model, and only when a pad is actually moving it: on the fee model the
    // rate never changes and a line repeating it would be noise on a 160px
    // card.
    // Which pad this venue hands out next, from the server's rule.
    const padMenu = padChoices(
      sess?.joystick_rule,
      (sess?.joysticks ?? []).filter((j) => j.stopped_at === null).map((j) => j.slot),
    );

    /**
     * A venue that sells its extras as ONE payment sells ONE extra, so its
     * card is a switch and not a menu: the controller is either out or it is
     * not, and the button says which.
     *
     * Both halves are read from the SERVER's answer — the rule says the venue
     * charges once, the session's own rows say whether a pad is out — so a
     * socket update or another cashier's press flips the button by itself.
     * Nothing about it is held in local state, which is what keeps two screens
     * on one seat from disagreeing.
     */
    const padSwitch = sess?.joystick_rule?.charge_once === true;
    const padOut = (sess?.joysticks ?? []).some(
      (j) => j.stopped_at === null && Number(j.slot) > BASE_JOYSTICKS,
    );
    // The pad this venue would hand over next, and null when it has none left
    // to give — a venue with no price set, or a ceiling already reached.
    const padNext = padMenu.find((c) => c.enabled)?.slot ?? null;

    const currentRate = ((): number | null => {
      if (sess === undefined || sess.is_free) return null;
      const active = (sess.joysticks ?? []).filter((j) => j.is_hourly && j.stopped_at === null);
      if (active.length === 0) return null;
      return sessionCurrentHourlyRate(sess);
    })();
    // What the last pad press did, said for 5s beside the card (2026-11-04):
    // which controllers, what they have earned, the one fee already taken,
    // and — under the hourly model — the rate the seat moved to. All read
    // from the server's row as it is NOW, so the note says what was agreed,
    // never what was asked for. No money on a waived seat: `padChargeOf` and
    // `currentRate` answer null there.
    const padNoteLines: string[] = sess !== undefined && supportsJoysticks && padNotes.isOn(sess.id)
      ? [
        `${t("session.joysticks")}: ${padIdentity(sess, BASE_JOYSTICKS)}`
          + (padCharge !== null ? ` · ${money(padCharge.total, preciseWhenSmall(padCharge.total))}` : "")
          + (sess.joystick_rule?.charge_once === true && sess.joystick_rule?.fee_taken === true
            ? ` · ${t("session.padFeeTaken")}` : ""),
        ...(currentRate !== null
          ? [`${t("session.currentRate")}: ${money(currentRate, preciseWhenSmall(currentRate))}${t("session.perHourShort")}`]
          : []),
      ]
      : [];
    // The two identity lines, resolved once so the JSX below stays readable.
    // A device with no place (a legacy row) has no platform or tier to show —
    // it still renders the line, as a non-breaking space, because a tile with
    // one line fewer than its neighbours is the other way this grid goes ragged.
    // Split rather than one string: the tier is the half an operator scans for
    // ("is this the VIP one?"), and a long custom platform — "Table Tennis" —
    // would otherwise eat the ellipsis and take the tier down with it. The
    // platform shrinks; the tier never does.
    const seatPlatformName = pc.place ? platformName(pc.place.platform) : "";
    const tierName = pc.place ? pc.place.type : "";
    // ⚠️ The NUMBER leads, always, and it is the same value the player is
    // given on their phone.
    //
    // This used to print the place's name when it had one and fall back to the
    // device's LABEL when the number was missing. Both halves broke the one
    // guarantee that matters here: a cashier and a player looking at the same
    // seat must say the same thing about it. A named seat showed the operator
    // no number at all, and an un-numbered one showed them "PS4-08" while
    // `placesSelect` showed the player `place.id`.
    //
    // `place.number ?? place.id` is exactly what the mobile screen renders, so
    // the two cannot diverge. The name follows as detail: the line is one row
    // with an ellipsis and the full text on hover, so it is the NAME that gets
    // cut on a narrow tile, never the number.
    const placeNo = pc.place ? (pc.place.number ?? pc.place.id) : null;
    const placeName = tr(pc.place, "name", lang).trim();
    const nameLine =
      placeNo === null
        ? tr(pc, "label", lang)
        : placeName
          ? `№${placeNo} · ${placeName}`
          : `№${placeNo}`;
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
    // No second press while the console is on its way (see tileGate).
    const startLock = startGate(lifecycle, consoleView?.snapshot.restingSince);
    const stopLock = stopGate(lifecycle, consoleView?.snapshot.wakingSince);
    return (
      <SessionCard
        key={pc.id}
        session={sess}
        baseColor={color}
        seatState={cellState}
        bookingAhead={freeUntil !== null}
        stateLabel={(tone) => t(`session.tone.${tone}`)}
        dragging={dragId === pc.id}
        dropSide={dragOverId === pc.id ? dropSideOf(order, dragId, pc.id) : null}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragId != null && dragId !== pc.id) {
            const fromPc = byId.get(dragId);
            if (fromPc && sectionKeyOf(fromPc) === sectionKeyOf(pc)) setDragOverId(pc.id);
          }
        }}
        onDrop={() => dropOn(pc.id)}
      >
        <SeatGrip
          label={t("session.dragToReorder")}
          onDragStart={(e) => {
            const cell = (e.currentTarget as HTMLElement).closest(".place-cell");
            if (cell) e.dataTransfer.setDragImage(cell, 24, 24);
            setDragId(pc.id);
          }}
          onDragEnd={() => { setDragId(null); setDragOverId(null); }}
        />
        {/* Line 1 — WHAT this seat is: platform and tier, the same
            "PS5 · STANDARD" wording the places board uses, so an operator
            reading both screens sees one vocabulary. The tier lives in
            `places.type` and was simply never rendered here; the board showed
            "PS5" and left standard and VIP indistinguishable.

            The agent dot keeps its place at the head of the line and is
            `flexShrink: 0`, so it cannot be squeezed out by a long label. */}
        <SeatPlatformLine deviceStatus={deviceStatus} platformName={seatPlatformName} tierName={tierName} />
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
              ? `${t("ps5.tile.bound")}: ${t(`ps5.lifecycle.${lifecycle}`)}${consoleView?.snapshot.error ? ` - ${t(`ps5.error.${consoleView.snapshot.error}`)}` : ""}`
              : `${t("ps5.tile.bound")}: ${t(PS5_STATE_LOOK[consoleState].key)}`}
          >
            <span
              className="ps5-chip__dot"
              style={{ background: lifecycle === "ERROR" ? "var(--color-danger)" : PS5_STATE_LOOK[consoleState].dot }}
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
        <SeatNameLine text={nameLine} />
        {sess ? (
          <>
            <span className="status">
              {/* The row itself, not a handful of its fields. Passing an
                  hourly rate a fixed session does not have is what left the
                  countdown branch with nothing to price from. */}
              <SessionTimer
                session={sess}
                formatMoney={money}
                minimumLabel={(minutes) => fmt(t("vipMin.badge"), durationLabel(minutes, t))}
                reset={mayReset ? { label: t("session.reset.button"), onReset: () => setResetId(sess.id) } : undefined}
              />
            </span>
            <span className="until">
              {/* The tariff line answers "what is this seat earning per hour",
                  and for a waived session the answer is not the venue's rate —
                  printing it there put a price the player will never be asked
                  for directly under a clock that was counting for free. */}
              {/* Secondary detail (2026-10-27): hidden in the Simple interface,
                  where the stripe, the clock and the money are the card. */}
              <span className="session-card__secondary">
              {sessionTariffLine(sess, money, t)}
              {itemsCount > 0 && <span className="muted"> · {itemsCount} {t("session.posNote")}</span>}
              </span>
              {sess.paused_at && (
                <span className="pill session-card__pill">
                  {(() => {
                    // A limited pause says when the server will resume it.
                    const until = autoResumeAtOf(sess);
                    return until === null
                      ? t("session.pausedBadge")
                      : fmt(t("session.pausedUntil"), new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
                  })()}
                </span>
              )}
              {/* «Свои продукты» (2026-11-13): the fee Start put on this bill,
                  the line's own figure. Already in the card's total. */}
              {foodFee !== null && (
                <span className="session-card__food" data-testid={`outside-food-note-${pc.id}`}>
                  <FeeSentence template={t("session.outsideFood.cardNote")} amount={`+${money(foodFee)}`} />
                </span>
              )}
            </span>
            {/* What the tile has to say at a glance and could not before: how
                many pads this seat is paying for, and whether it is paying at
                all. Both come from the server — the count is never derived
                here, or two cashiers would read different numbers off the same
                seat. The pads render only for a PlayStation, where the concept
                exists; a computer showing "🎮 1" would be noise. */}
            {(supportsJoysticks || sess.is_free) && (
              <span className="row" style={PAD_LINE_STYLE}>
                {/* Pads are a PlayStation thing, and the seat says so itself:
                    `supports_joysticks` is the backend's answer — the place's
                    platform where the seat has a place, the device's own kind
                    where it has none. Never the label: "PS4-08" is a name
                    somebody typed, and a venue that renames a seat would lose
                    its controls.

                    Shown for every PlayStation seat, not only one that already
                    has a second pad: a control that appears once you have
                    already used it is a control nobody finds. */}
                {/* What a pad press did (identity, its money, the rate it
                    moved to) is no longer written here: a line that appears
                    when a pad goes out made the card taller, and every card in
                    its row with it (owner, 2026-11-04). It is said for 5s in an
                    orange note beside the card instead (PadChargeNote, below).
                    The empty span keeps the line's shape — the board's CSS
                    hides an empty pad line, and the interface preview draws
                    the same one. */}
                <span className="row" style={PAD_COUNT_STYLE} />
                {sess.is_free && (
                  <span className="pill session-card__pill">
                    {t("session.freeBillShort")}
                  </span>
                )}
              </span>
            )}
            <div className="session-card__actions">
              {/* The joystick switch is the FIRST cell of the action grid, the
                  same size and style as every action beside it (2026-10-25).
                  It used to sit on the no-wrap pad line for a per-pad venue
                  and here for a charge-once one, so two seats side by side
                  drew it in two places at two sizes. One place now, both
                  venues; only the names differ: a charge-once seat hands out
                  ONE pad ("hand out / take back the joystick") and is no menu. */}
              {supportsJoysticks && (
                <PadToggle
                  next={padSwitch && padOut ? null : (padMenu.find((c) => c.enabled) ?? null)}
                  extrasOut={padSwitch
                    ? (padOut ? 1 : 0)
                    : (sess.joysticks ?? []).filter(
                      (j) => j.stopped_at === null && Number(j.slot) > BASE_JOYSTICKS,
                    ).length}
                  busy={padBusy.isBusy(sess.id)}
                  onAdd={(slot) => void addPad(sess, slot)}
                  onRemove={() => void removeTopPad(sess)}
                  {...(padSwitch ? {
                    addLabelKey: "session.padAddOne",
                    removeLabelKey: "session.padRemoveOne",
                    groupLabelKey: null,
                  } : {})}
                />
              )}
              <SessionCardAction
                data-action="add-item"
                icon="add-item"
                label={t("session.card.addItem")}
                fullLabel={t("session.addItem")}
                onClick={() => setAddItemTarget(sess)}
              />
              {/* The less frequent actions (2026-10-27): inline as always,
                  or folded into «Ещё» in the Simple interface — the same
                  buttons and handlers either way (CardOverflow). */}
              <CardOverflow collapsed={quickActions === "primary"} label={t("session.card.more")}>
              {/* Only on a seat whose room hands something out, and labelled
                  with that room's own word. The server sends the object or
                  null, so a control that appears here is one the server will
                  honour — the same rule the pad menu follows. */}
              {sess.extra_item && (() => {
                // ONE control that toggles, exactly as the pad button does:
                // hand it out, and the same button becomes "take it back".
                // Two buttons side by side made the board ask a question the
                // seat had already answered.
                // The room's word and nothing else — no price, no "paid", no
                // rate, on a fixed room or an hourly one. The owner's call
                // (2026-09-23): the button says what it does; the bill says
                // what it cost.
                //
                // ⚠️ WHAT it does is the server's answer (2026-09-23): a fixed
                // room sells once per session, so after its sale the button
                // is greyed and offers no return (`can_hand_out` false,
                // `return_item_id` null); an hourly room names the line to
                // take back. `openExtra` is only the fallback for a server
                // that predates the two keys.
                const extra = sess.extra_item!;
                const backId = extra.return_item_id !== undefined
                  ? extra.return_item_id
                  : openExtra(sess)?.id ?? null;
                const label = backId !== null
                  ? fmt(t("session.extraReturn"), extra.name)
                  : fmt(t("session.extraAdd"), extra.name);
                const shortLabel = backId !== null
                  ? fmt(t("session.card.extraReturn"), extra.name)
                  : fmt(t("session.card.extraAdd"), extra.name);

                return (
                  <SessionCardAction
                    data-action="extra"
                    icon="extra"
                    label={shortLabel}
                    fullLabel={label}
                    onClick={() => {
                      if (backId !== null) { void returnExtra(sess, backId); return; }
                      void handOutExtra(sess);
                    }}
                    disabled={
                      extraBusy.isBusy(sess.id)
                      || (backId !== null && returningItem === backId)
                      || (backId === null && extra.can_hand_out === false)
                    }
                  />
                );
              })()}
              {/* «+ Время» — ONE button whatever the seat's mode (2026-11-07,
                  owner): the dialog shows the mode and what is left, and
                  offers what fits it — more time (by time or by money) and
                  «Безлимит» on a timed seat, a fixed time on an unlimited one —
                  and «Не оплачено». The two mode buttons beside it are gone. */}
              {sess.status === "active" && (
                <SessionCardAction
                  data-action="add-time"
                  icon="add-time"
                  label={t("session.card.addTime")}
                  fullLabel={t("session.addTime")}
                  onClick={() => setOptionsTarget(sess)}
                />
              )}
              {/* Pause ↔ Resume, one control, on every kind of seat. The
                  session stays active either way — the seat stays taken and a
                  console stays awake — only the clock and the bill hold. */}
              <SessionCardAction
                data-action={sess.paused_at ? "resume" : "pause"}
                icon={sess.paused_at ? "resume" : "pause"}
                label={sess.paused_at ? t("session.card.resume") : t("session.pause")}
                fullLabel={sess.paused_at ? t("session.resume") : t("session.pause")}
                onClick={() => { void togglePause(sess); }}
                disabled={pauseBusy.isBusy(sess.id)}
              />
              {/* ⚠️ "Options" is gone from the tile, and NOTHING behind it was
                  removed. `SessionOptionsDialog` is the Add Time dialog and is
                  still opened by the button above it, with its presets, its
                  manual grant, the unlimited switch and the whole
                  booking-conflict and seat-migration flow untouched.
                  It cost the tile a third button and bought nothing: for a
                  session with an end, it opened the same dialog the Add Time
                  button already opens; for an unlimited one the dialog has no
                  action at all, only two "not applicable" notices. Two buttons
                  and one of them a duplicate is how a cashier learns to stop
                  reading them. */}
              {/* Not while PAUSED: the server refuses a move then — a pause
                  belongs to the seat it began on, so resume first. */}
              {!sess.paused_at && (
                <SessionCardAction
                  data-action="relocate"
                  icon="relocate"
                  label={t("session.card.relocate")}
                  fullLabel={t("session.relocate")}
                  wide
                  onClick={() => setRelocateTarget(sess)}
                />
              )}
              </CardOverflow>
              {/* Destructive, so it reads as such and spans the row: the one
                  button on the card a slip must not land on by accident. */}
              <SessionCardAction
                data-action="stop"
                icon="stop"
                label={t(stopLock.labelKey ?? "action.stop")}
                fullLabel={t(stopLock.labelKey ?? "action.stop")}
                danger
                disabled={stopLock.disabled}
                onClick={() => setStopTarget(sess)}
              />
            </div>
            {/* Refusals, on the seat they belong to — for EVERY kind of seat.
                The pad/extra refusal used to live inside the PlayStation-only
                pad block, so a refused hand-out on a custom room (where extras
                exist and pads do not) showed nothing at all. */}
            {padError?.id === sess.id && (
              <span className="error session-card__error">{padError.message}</span>
            )}
            {pauseError?.id === sess.id && (
              <span className="error session-card__error">{pauseError.message}</span>
            )}
            {/* The last pad press, for 5s, beside the card — never in it. */}
            <PadChargeNote lines={padNoteLines} testId={`pad-note-${sess.id}`} />
          </>
        ) : (
          <>
            {/* The platform used to be repeated here ("Свободно · PS5") because
                the header could not be trusted to show it. It has its own line
                now, with the tier, so the status says only what it is for: the
                state of the seat. */}
            {(() => {
              // A reserved seat (2026-11-07, owner): yellow, and no big word
              // on it — its time, with who is coming and the whole booking in
              // the tooltip. The word stays until the booking itself is known.
              const b = isReserved && pc.place_id != null ? reservations.get(pc.place_id) : undefined;
              if (isReserved && b) {
                return (
                  <span className="status session-card__reservation" data-testid="reservation-contact" data-tip={reservationTip(b, t)}>
                    {reservationWindow(b)}
                  </span>
                );
              }
              // Free now, reserved later (`freeUntil` above; 2026-11-08, owner):
              // the word «Свободно» turns into «Свободно до 05:30» in its own
              // place while the card is pointed at or focused, and back after.
              // The full sentence is the one read aloud.
              if (freeUntil) {
                return (
                  <span className="status session-card__status-swap" data-tip={t("start.freeUntilCardTip")}>
                    <span className="session-card__status-word" aria-hidden>{t("session.free")}</span>
                    <span className="session-card__free-until" data-testid="free-until">
                      {fmt(t("start.freeUntilCard"), freeUntil)}
                    </span>
                  </span>
                );
              }
              return (
                <span className="status">
                  {isOffline ? t("session.deviceOffline") : isReserved ? t("session.reserved") : t("session.free")}
                </span>
              );
            })()}
            {isOffline && (
              // Two lines, never an ellipsis: this is the sentence that tells
              // the cashier WHY the seat cannot start.
              <span className="session-card__hint" title={t("session.deviceOfflineHint")}>
                {t("session.deviceOfflineHint")}
              </span>
            )}
            {/* The card's foot, like the running card's action grid: pinned to
                the bottom, so every Start in a row sits on one line whatever
                is above it (a console chip, an offline hint). */}
            <div className="session-card__foot">
              {(() => {
                const reservation = isReserved && pc.place_id != null ? reservations.get(pc.place_id) : undefined;
                // A reserved seat (2026-11-07): Start is the player arriving —
                // the ordinary start, carrying the reservation — and the
                // reservation can be called off. Only once its booking is known.
                if (reservation) {
                  return (
                    <ReservationActions
                      bookingId={reservation.id}
                      seat={seatOf(pc.id)}
                      // Who sits down is asked in Start (2026-11-07): the
                      // reservation is never assumed from the card.
                      onStart={() => setStartTarget(pc)}
                      disabled={isOffline || startLock.disabled}
                      startLabel={t(startLock.labelKey ?? "action.start")}
                      startHint={isOffline ? t("session.deviceOfflineHint") : undefined}
                    />
                  );
                }
                return (
                  <div className="session-card__reserve-actions">
                    <CardFootAction
                      icon="start"
                      label={t(startLock.labelKey ?? "action.start")}
                      hint={isOffline ? t("session.deviceOfflineHint") : undefined}
                      onClick={() => setStartTarget(pc)}
                      disabled={!canStart || startLock.disabled}
                      className="session-card__start"
                      data-action="start"
                    />
                    {!isReserved && pc.place_id != null && (
                      <CardFootAction
                        icon="reserve"
                        variant="secondary"
                        label={t("reserve.buttonShort")}
                        fullLabel={t("reserve.button")}
                        onClick={() => setCalendar({ focusPlaceId: pc.place_id as number })}
                        data-action="reserve"
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </SessionCard>
    );
  };

  // Both reads again; each keeps what it already had if this one fails too.
  const retryBoard = () => { void pcs.reload(); void sessions.reload(); };
  // A first load that failed: the error (offline / failed) with Retry. Never
  // "No devices registered" — a board that could not be read is not empty.
  if (pcs.error && !pcs.data) return <ErrorState error={pcs.error} onRetry={retryBoard} titleKey="session.state.errorTitle" />;
  if (sessions.error && !sessions.data) return <ErrorState error={sessions.error} onRetry={retryBoard} titleKey="session.state.errorTitle" />;
  if (!pcs.data || !sessions.data) return <GridSkeleton />;
  // A later refresh that failed keeps the seats on screen, with a quiet line.
  const staleError = pcs.error ?? sessions.error;

  return (
    <div className="col" style={{ gap: 18 }} data-tip-scope>
      <div className="row-between" style={{ flexWrap: "wrap", rowGap: 8 }}>
        {/* ⚠️ The heading used to read "Sessions · №{branchId}" — the BRANCH's
            surrogate id, next to a word about sessions, in a section full of
            numbered seats. At a venue with six seats it printed "№4" and was
            read as a seat number, or as a count of something. It is neither.
            What an operator actually wants from a heading here is how much of
            the room is in use, so that is what it says now. */}
        <div className="col" style={{ gap: 2 }}>
          <h2 className="page-title" style={{ margin: 0 }}>{t("session.boardTitle")}</h2>
          {orderedPcs.length > 0 && (
            <span className="muted" style={{ fontSize: 12 }}>
              {t("session.boardCounts")
                .replace("{0}", String(orderedPcs.length))
                .replace("{1}", String(occupiedCount))
                .replace("{2}", String(orderedPcs.length - occupiedCount))}
            </span>
          )}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", rowGap: 8 }}>
          {/* "+ Продукт" (2026-10-25): a guest who came only for a juice or
              crisps. The till's own sale — the same dialog, request, server
              prices, payment methods and double-submit guard as «Касса» —
              without leaving the board and without touching any seat: a sale
              is the branch's, so nothing starts a session. */}
          <button
            type="button"
            className="outline-btn board-sell-btn"
            onClick={() => setSellOpen(true)}
            title={t("till.sell")}
            data-testid="board-sell"
          >
            {t("session.sellProduct")}
          </button>
          <Link to={`/branches/${branchId}/sessions/history`} className="outline-btn">{t("history.title")}</Link>
          <button
            type="button"
            className="outline-btn board-calendar-btn"
            onClick={() => setCalendar({})}
            data-testid="board-calendar"
          >
            {t("calendar.title")}
          </button>
          <Link to={`/branches/${branchId}/pcs`} className="outline-btn">{t("pcs.title")}</Link>
          {can(role, "branch.prices") && (
            <Link to={`/branches/${branchId}/tariffs`} className="outline-btn">{t("hub.tile.prices")}</Link>
          )}
        </div>
      </div>

      {staleError && <StaleNotice error={staleError} onRetry={retryBoard} />}
      {/* What the colours mean, for the Simple interface (2026-10-27). */}
      {density === "simple" && orderedPcs.length > 0 && <SimpleBoardHelp />}
      {orderedPcs.length === 0 ? (
        <StateView variant="empty" titleKey="session.state.noPcsTitle" descriptionKey="session.state.noPcsDescription" />
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
                dropSide={dropSection === key ? dropSideOf(sectionReorder.ordered, dragSection, key) : null}
                onDragStart={onSectionDragStart(key)}
                onDragEnd={() => { setDragSection(null); setDropSection(null); }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragSection && dragSection !== key) setDropSection(key);
                }}
                onDrop={() => onSectionDrop(key)}
              >
                <div className={`live-grid live-grid--sessions${dragId != null ? " is-reordering" : ""}`}>
                  {items.map(renderCell)}
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      )}

      {calendar && (
        <BookingsCalendarModal
          branchId={branchId}
          focusPlaceId={calendar.focusPlaceId}
          places={orderedPcs
            .filter((pc) => pc.place_id != null)
            .map((pc) => ({
              id: pc.place_id as number,
              number: pc.place?.number ?? pc.place_id as number,
              label: seatOf(pc.id),
              platform: pc.place?.platform,
              offline: resolveSessionCellState({ hasSession: false, isReserved: false, device: pc }) === "offline",
            }))}
          sessions={(sessions.data ?? [])
            .filter((sess) => sess.status === "active")
            .flatMap((sess) => {
              const placeId = (pcs.data ?? []).find((pc) => pc.id === sess.pc_id)?.place_id;
              return placeId == null ? [] : [{
                placeId,
                startedAt: new Date(sess.started_at),
                endsAt: sess.ends_at ? new Date(sess.ends_at) : null,
                unlimited: sess.is_unlimited === true || sess.ends_at === null,
              }];
            })}
          // «Старт» on a booking in the calendar: the calendar closes and
          // Start opens on that seat with the booking already chosen.
          onStartBooking={(placeId, bookingId) => {
            const target = (pcs.data ?? []).find((pc) => pc.place_id === placeId);
            if (!target) return;
            setCalendar(null);
            setStartBookingId(bookingId);
            setStartTarget(target);
          }}
          onClose={() => { setCalendar(null); void pcs.reload(); }}
        />
      )}
      {startTarget && (
        <StartSessionDialog
          bookingId={startBookingId}
          branchId={branchId}
          pc={startTarget}
          onClose={() => { setStartTarget(null); setStartBookingId(undefined); }}
          onStarted={() => {
            // The console may legitimately wake from now on. Said BEFORE the
            // reload, because the monitor can tick before the session row is
            // visible — and a monitor that sees "awake, no session" is a
            // monitor that switches the console off under the player.
            if (startTarget.console_host_id) sessionStarting(startTarget.id);
            setStartTarget(null);
            setStartBookingId(undefined);
            void sessions.reload();
            void pcs.reload();
          }}
        />
      )}
      {stopTarget && (
        <StopReceiptModal
          session={stopTarget}
          onClose={() => { setStopTarget(null); void sessions.reload(); void pcs.reload(); }}
          onConfirmed={(outcome) => {
            // The session is over on the backend, so the console should be
            // asleep. Whether this build can actually ask it to is the
            // transport's business — and its refusal is shown, not swallowed.
            const device = (pcs.data ?? []).find((pc) => pc.id === stopTarget.pc_id);
            if (device?.console_host_id) sessionStopped(device.id);
            // Green (2026-09-28): a stop the server confirmed is a completed
            // checkout, not a failure. Only such a stop reaches here — an
            // auto-ended seat's receipt never calls this.
            // A cancel (2026-11-06) frees the seat the same way; its toast says
            // it was cancelled, not paid.
            notify.message("success", fmt(t(outcome?.cancelled ? "session.cancel.toast" : "session.toastStopped"), seatOf(stopTarget.pc_id)));
            noticeUnpaid(stopTarget.id, stopTarget.pc_id, outcome?.unpaidAmount);
            void sessions.reload();
            void pcs.reload();
          }}
          onItemRemoved={() => { void sessions.reload(); }}
          canResetTime={mayReset}
          onTimeReset={() => { void sessions.reload(); }}
          // The same right as the reset: both give money away.
          canCancel={mayReset}
        />
      )}
      {optionsTarget && (
        <SessionOptionsDialog
          session={optionsTarget}
          platform={(pcs.data ?? []).find((pc) => pc.id === optionsTarget.pc_id)?.place?.platform}
          platformName={platformName}
          onClose={() => { setOptionsTarget(null); void sessions.reload(); }}
          // The server's answer replaces the dialog's copy AND the board's row,
          // so the tile behind the dialog is never a version behind it.
          onChanged={(updated) => {
            // A grant refused here can end in a MOVE to another seat; the
            // consoles on both sides must hear of it as a relocation does.
            consolesFollowMove(optionsTarget.pc_id, updated.pc_id);
            setOptionsTarget(updated);
            void sessions.reload();
          }}
        />
      )}
      <UnpaidAlert
        notices={unpaidNotices}
        onDismiss={(id) => setUnpaidNotices((list) => list.filter((n) => n.sessionId !== id))}
      />
      {resetTarget && (
        <ResetTimeDialog
          session={resetTarget}
          seat={seatOf(resetTarget.pc_id)}
          onClose={() => setResetId(null)}
          onDone={(updated, waived) => {
            setResetId(null);
            // The server's whole row at once (the reset may re-base the plan
            // too), so the card reads 0 before the reload.
            sessions.mutate((list) => list?.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)) ?? list);
            notify.message("success", fmt(t("session.reset.toast"), seatOf(updated.pc_id), money(Math.max(0, waived))));
            void sessions.reload();
          }}
        />
      )}
      {relocateTarget && (
        <RelocateSessionDialog
          session={relocateTarget}
          platformName={platformName}
          onClose={() => { setRelocateTarget(null); void sessions.reload(); }}
          onMoved={(updated, from) => {
            consolesFollowMove(from.pcId, updated.pc_id);
            setRelocateTarget(null);
            void sessions.reload();
            void pcs.reload();
          }}
        />
      )}
      {sellOpen && (
        <SellProductsDialog branchId={branchId} onClose={() => setSellOpen(false)} onSold={() => {}} />
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

export default SessionsBoard;
