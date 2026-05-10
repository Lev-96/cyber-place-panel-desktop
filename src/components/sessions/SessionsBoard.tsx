import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { useBookingChanged } from "@/realtime/useBookingChanged";
import { usePlaceAvailability } from "@/realtime/usePlaceAvailability";
import { bookingRepository } from "@/repositories/BookingRepository";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AddSessionItemDialog from "./AddSessionItemDialog";
import SessionTimer from "./SessionTimer";
import StartSessionDialog from "./StartSessionDialog";
import StopReceiptModal from "./StopReceiptModal";

/**
 * `d-m-Y` clock-time-of-day stamp — matches what the booking
 * IndexRequest validator accepts (see backend
 * `app/Http/Requests/Bookings/IndexRequest.php` rules
 * `date_format:d-m-Y`). Local time on purpose: the cashier and
 * the backend's app timezone (Asia/Yerevan) are the same.
 */
const toDMY = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/**
 * Pull the IDs of every place currently held by an upcoming or
 * active booking on `branchId`. Used to seed and re-sync the
 * Sessions board's reserved-tile overlay — Reverb gives us the
 * delta stream, this is the snapshot side.
 *
 * Filtered client-side via `Booking.isUpcoming` / `isActiveAt`,
 * which already encode the "blocking statuses" rule (pending /
 * confirmed only; cancelled rows are ignored), so a cancelled
 * booking never lingers as orange.
 */
const fetchReservedPlaceIds = async (branchId: number): Promise<Set<number>> => {
  const now = new Date();
  const bookings = await bookingRepository.listAll({
    branch_id: branchId,
    // Today + future. Past bookings on `booking_date < today` can't
    // still be active (their end is in the past), so omitting them
    // shrinks the page count without losing accuracy.
    date_from: toDMY(now),
  });
  const ids = new Set<number>();
  for (const b of bookings) {
    if (!(b.isUpcoming(now) || b.isActiveAt(now))) continue;
    for (const id of b.placeIds) ids.add(id);
  }
  return ids;
};

const navBtn: React.CSSProperties = { padding: "6px 10px", border: "1px solid #1f2a44", borderRadius: 6 };

interface Props {
  branchId: number;
}

const SessionsBoard = ({ branchId }: Props) => {
  const { money, t } = useLang();
  const { user } = useAuth();
  const role = user?.role;
  const pcs = useAsync(() => sessionRepository.listPcs(branchId), [branchId]);
  const sessions = useAsync(() => sessionRepository.listActive(branchId), [branchId]);
  const [startTarget, setStartTarget] = useState<IPcApi | null>(null);
  const [stopTarget, setStopTarget] = useState<ISessionApi | null>(null);
  const [addItemTarget, setAddItemTarget] = useState<ISessionApi | null>(null);
  // Set of place IDs currently reserved by an upcoming/active
  // booking. Hydrated from REST on mount (so re-entering the
  // screen restores the orange paint), then kept fresh by both
  // `booking.changed` Reverb deltas and a 30s sanity refetch
  // below.
  const [reservedPlaceIds, setReservedPlaceIds] = useState<Set<number>>(new Set());

  // Snapshot-on-mount: without this, navigating away from the
  // board and back wiped `reservedPlaceIds` because Reverb is a
  // delta channel — any booking created while the screen was
  // unmounted was invisible until the next event landed.
  const reloadReservedIds = useCallback(async () => {
    if (!Number.isFinite(branchId)) return;
    try {
      const ids = await fetchReservedPlaceIds(branchId);
      setReservedPlaceIds(ids);
    } catch {
      // Tile stays as-is; Reverb will repopulate on the next event
      // and the 30s sweep will retry. Swallowed on purpose so a
      // transient hiccup doesn't crash the board.
    }
  }, [branchId]);

  useEffect(() => {
    void reloadReservedIds();
  }, [reloadReservedIds]);

  // Reverb pushes a fresh event whenever a place transitions in/out of
  // a session. We just kick a reload — the existing reload covers
  // sessions + pcs in one step. This is the "real-time" path.
  usePlaceAvailability(
    branchId,
    useCallback(() => {
      void sessions.reload();
      void pcs.reload();
    }, [sessions, pcs]),
  );

  // Booking lifecycle realtime: paint reserved tiles. The cross-screen
  // toast lives in `<GlobalBookingNotifier />` (mounted in Layout) so
  // the cashier sees the banner regardless of which screen they're on.
  // This subscription is for the local tile-state side-effect only.
  //
  // `kind`-aware: a `cancelled` event must REMOVE the place_ids
  // it carries, otherwise a cancelled booking would linger as
  // orange until the next sanity sweep. Created / extended /
  // confirmed all keep the tile reserved.
  useBookingChanged(
    Number.isFinite(branchId) ? `branch.${branchId}` : null,
    useCallback((evt) => {
      setReservedPlaceIds((prev) => {
        const next = new Set(prev);
        if (evt.kind === "cancelled") {
          for (const id of evt.place_ids) next.delete(id);
        } else {
          for (const id of evt.place_ids) next.add(id);
        }
        return next;
      });
    }, []),
  );

  // Polling fallback. Reverb is the primary realtime path now;
  // 30s is a sanity-check sweep for cases where the WebSocket
  // dropped silently (Reverb restart, tab backgrounded long enough
  // for the OS to throttle, network change). Imperceptible on the
  // happy path, full recovery on the rare drop. Also re-syncs
  // reserved tiles so expired bookings drop off naturally.
  useEffect(() => {
    const t = setInterval(() => {
      void sessions.reload();
      void pcs.reload();
      void reloadReservedIds();
    }, 30_000);
    return () => clearInterval(t);
  }, [sessions, pcs, reloadReservedIds]);

  if ((pcs.loading && !pcs.data) || (sessions.loading && !sessions.data)) return <Spinner />;
  if (pcs.error && !pcs.data) return <div className="error">{pcs.error.message}</div>;
  if (sessions.error && !sessions.data) return <div className="error">{sessions.error.message}</div>;

  const sessionByPc = new Map<number, ISessionApi>();
  for (const s of sessions.data ?? []) sessionByPc.set(s.pc_id, s);

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between" style={{ flexWrap: "wrap", rowGap: 8 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{t("session.boardTitle")} · #{branchId}</h2>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", rowGap: 8 }}>
          <Link to={`/branches/${branchId}/sessions/history`} className="muted" style={navBtn}>{t("history.title")}</Link>
          <Link to={`/branches/${branchId}/pcs`} className="muted" style={navBtn}>{t("pcs.title")}</Link>
          {can(role, "branch.prices") && (
            <Link to={`/branches/${branchId}/tariffs`} className="muted" style={navBtn}>{t("hub.tile.prices")}</Link>
          )}
        </div>
      </div>
      <div className="live-grid">
        {(pcs.data ?? []).map((pc) => {
          const sess = sessionByPc.get(pc.id);
          // Precedence: active session (green) > reserved booking
          // (orange) > free (grey). A place can be both — a session
          // running on a pre-booked slot — but the active session is
          // what the cashier acts on, so it wins.
          const isReserved =
            !sess && pc.place_id != null && reservedPlaceIds.has(pc.place_id);
          const color = sess ? "#22c55e" : isReserved ? "#f59e0b" : "#6b7280";
          const itemsCount = sess?.items?.length ?? 0;
          return (
            <div key={pc.id} className="place-cell" style={{ borderColor: color, minHeight: 160 }}>
              <span className="dot" style={{ background: color }} />
              <span className="platform">{pc.label}{pc.kind === "ps" && <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>PS</span>}</span>
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
                  {/* `flexWrap: wrap` + `flex: 1 0 auto` lets the two
                      buttons stay side-by-side on wide cells and stack
                      cleanly into two rows on narrow ones — important
                      because the grid item can be as tight as 160px and
                      RU/AM labels ("+ услуга", "+ ծառայություն") are
                      noticeably wider than the EN baseline. */}
                  <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    <Button variant="secondary" onClick={() => setAddItemTarget(sess)} style={miniBtnFlex}>{t("session.addService")}</Button>
                    <Button variant="secondary" onClick={() => setStopTarget(sess)} style={miniBtnFlex}>{t("action.stop")}</Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="status" style={{ color }}>
                    {isReserved
                      ? t("session.reserved") || "Reserved"
                      : `${t("session.free")}${pc.kind === "ps" ? " · PS" : ""}`}
                  </span>
                  <Button onClick={() => setStartTarget(pc)} style={{ padding: "6px 10px", fontSize: 12, marginTop: 6 }}>{t("action.start")}</Button>
                </>
              )}
            </div>
          );
        })}
        {!pcs.data?.length && <div className="muted">No PCs registered.</div>}
      </div>

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

// `flex: 1 0 auto` — button starts at its content's natural width so
// short EN labels don't stretch awkwardly, but it can grow to share
// the available row width, and won't shrink below content (which would
// otherwise clip a Cyrillic / Armenian label).
const miniBtnFlex: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  flex: "1 0 auto",
  minWidth: 0,
};

export default SessionsBoard;
