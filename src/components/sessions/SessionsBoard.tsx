import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useReservedPlaceIds } from "@/hooks/useReservedPlaceIds";
import { useLang } from "@/i18n/LanguageContext";
import { usePlaceAvailability } from "@/realtime/usePlaceAvailability";
import { sessionRepository } from "@/repositories/SessionRepository";
import { IPcApi, ISessionApi } from "@/types/sessions";
import { PC_STATUS_COLOR } from "@/types/pc";
import { platformLabel } from "@/utils/platform";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AddSessionItemDialog from "./AddSessionItemDialog";
import SessionTimer from "./SessionTimer";
import StartSessionDialog from "./StartSessionDialog";
import StopReceiptModal from "./StopReceiptModal";

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
  // Reserved-tile overlay state owned by the shared hook — pairs
  // a REST snapshot (re)mount + sanity-sweep with the
  // `booking.changed` Reverb delta. The Branch places grid uses
  // the same hook, so the two screens can never disagree about
  // which seats are currently held.
  const reservedPlaceIds = useReservedPlaceIds(branchId);

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

  // Polling fallback for the session-side data. Reverb is the
  // primary realtime path; 30s is a sanity-check sweep for cases
  // where the WebSocket dropped silently. Reserved-tile state
  // has its own internal sweep inside `useReservedPlaceIds`.
  useEffect(() => {
    const t = setInterval(() => {
      void sessions.reload();
      void pcs.reload();
    }, 30_000);
    return () => clearInterval(t);
  }, [sessions, pcs]);

  if ((pcs.loading && !pcs.data) || (sessions.loading && !sessions.data)) return <Spinner />;
  if (pcs.error && !pcs.data) return <div className="error">{pcs.error.message}</div>;
  if (sessions.error && !sessions.data) return <div className="error">{sessions.error.message}</div>;

  const sessionByPc = new Map<number, ISessionApi>();
  for (const s of sessions.data ?? []) sessionByPc.set(s.pc_id, s);

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
              {/*
                Title = the place's name if it has one, else its number
                (same value the mobile guest sees on `placesSelect`),
                falling back to the device label for legacy unlinked rows.
                The inline dot is the DEVICE status (online/offline/busy),
                distinct from the corner session-state dot above. The badge
                names the platform (PS4 / Table Tennis …) for non-pc places.
              */}
              <span className="platform" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span
                  title={pc.status}
                  style={{ width: 8, height: 8, borderRadius: 4, background: PC_STATUS_COLOR[pc.status], flexShrink: 0 }}
                />
                <span>{pc.place?.name?.trim() || `№${pc.place?.number ?? pc.label}`}</span>
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
                      : `${t("session.free")}${pc.place && pc.place.platform !== "pc" ? ` · ${platformLabel(pc.place.platform)}` : ""}`}
                  </span>
                  {/*
                    Start is disabled while the seat is held by an
                    upcoming/active booking — the cashier must wait
                    for the guest to confirm-by-code (which converts
                    the booking into the session) instead of opening
                    a parallel walk-in session that would conflict.
                    The orange tile + "Reserved" label make the
                    state legible; the disabled button makes the
                    state non-bypassable from this screen.
                  */}
                  <Button
                    onClick={() => setStartTarget(pc)}
                    disabled={isReserved}
                    style={{ padding: "6px 10px", fontSize: 12, marginTop: 6 }}
                  >
                    {t("action.start")}
                  </Button>
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
