import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { useBookingChanged, type BookingChangedEvent } from "@/realtime/useBookingChanged";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * App-shell-level booking-event notifier. Lives once in `Layout`
 * so the cashier sees a freshly created / extended booking the
 * moment it lands on the wire — regardless of which screen they
 * happen to be on (POS, history, billing, etc.).
 *
 * Was previously coupled to `SessionsBoard`'s local toast; that
 * worked only when the cashier was already on the board. Splitting
 * it out keeps SessionsBoard responsible for the reserved-tile
 * overlay (its own UI state) and lets this component own the
 * cross-screen banner.
 *
 * Branch resolution: managers carry `dashboard.branch_id` in their
 * AuthUser payload — that's the branch they cash for. Owners and
 * admins don't have a single pinned branch; they get notifications
 * via the existing push / email / database channel from
 * `BookingObserver`, so leaving them unsubscribed here is correct
 * (subscribing to "all" branches would require a different channel
 * design).
 */
const AUTO_DISMISS_MS = 8_000;

interface ToastModel {
  kind: "created" | "extended";
  code: string | number | null;
  bookingId: number;
  branchId: number;
  placeIds: number[];
  rescheduledMinutes: number;
}

const GlobalBookingNotifier = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  // For now, only managers (cashiers) get the in-app banner. Owners/
  // admins receive the push + email channels from the same backend
  // event; an "all branches" UI subscription is a separate, larger
  // change.
  const branchId =
    user?.role === "manager" ? user.dashboard?.branch_id ?? null : null;

  const [toast, setToast] = useState<ToastModel | null>(null);

  const handleEvent = useCallback((evt: BookingChangedEvent) => {
    setToast({
      kind: evt.kind,
      code: evt.code,
      bookingId: evt.booking_id,
      branchId: evt.branch_id,
      placeIds: evt.place_ids ?? [],
      rescheduledMinutes: evt.rescheduled_minutes ?? 0,
    });
  }, []);

  useBookingChanged(branchId, handleEvent);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;

  const isExtended = toast.kind === "extended";
  const title = isExtended
    ? t("notifications.bookingExtendedTitle") || "Booking extended"
    : t("notifications.newBookingTitle") || "New booking";
  const placeLabel =
    toast.placeIds.length === 1
      ? t("notifications.bookingPlaces") || "Place"
      : t("notifications.bookingPlacesPlural") || "Places";
  const minShort = t("notifications.bookingMinShort") || "min";
  const openBoard = t("notifications.openBoard") || "Open board";

  const handleOpen = () => {
    setToast(null);
    navigate(`/branches/${toast.branchId}/sessions`);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9000,
        maxWidth: 360,
        borderRadius: 8,
        background: isExtended ? "rgba(245, 158, 11, 0.18)" : "rgba(7, 221, 241, 0.14)",
        borderLeft: `4px solid ${isExtended ? "#f59e0b" : "#07ddf1"}`,
        padding: "12px 14px",
        boxShadow: "0 6px 22px rgba(0, 0, 0, 0.35)",
        color: "#e5e7eb",
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {title} #{toast.code ?? toast.bookingId}
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        {placeLabel}: {toast.placeIds.join(", ") || "—"}
        {isExtended && toast.rescheduledMinutes > 0 && (
          <>
            {" · +"}
            {toast.rescheduledMinutes} {minShort}
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={handleOpen}
          style={{
            padding: "4px 10px",
            border: "1px solid #1f2a44",
            borderRadius: 6,
            background: "transparent",
            color: "#e5e7eb",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {openBoard}
        </button>
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Dismiss"
          style={{
            marginLeft: "auto",
            padding: "4px 10px",
            border: "1px solid #1f2a44",
            borderRadius: 6,
            background: "transparent",
            color: "#9ca3af",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default GlobalBookingNotifier;
