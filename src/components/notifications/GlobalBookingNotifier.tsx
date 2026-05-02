import { useAuth } from "@/auth/AuthContext";
import type { AuthUser } from "@/types/api";
import { useLang } from "@/i18n/LanguageContext";
import { useNotifications } from "@/notifications/NotificationsContext";
import { useBookingChanged, type BookingChangedEvent } from "@/realtime/useBookingChanged";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * App-shell-level booking-event notifier. Lives once in `Layout`
 * so every authenticated user (admin / owner / manager) sees a
 * freshly created or extended booking the moment it lands on the
 * wire — regardless of which screen they're on.
 *
 * Channel resolution by role:
 *   admin    → `bookings.global`        — every booking, every company
 *   owner    → `company.{company_id}`   — every branch under their company
 *   manager  → `branch.{branch_id}`     — single branch they cash for
 *
 * The same backend event fan-outs to all three channels (see
 * `App\Events\BookingChanged::broadcastOn()`), so each role gets
 * exactly one toast — no role gets it twice.
 */
const AUTO_DISMISS_MS = 8_000;

/**
 * One-time permission ask. Browsers (and Electron's renderer) only
 * grant `Notification.permission === 'granted'` after `requestPermission()`
 * returns; calling it repeatedly is fine but pointless, so we lazy-init
 * on first event arrival.
 */
let permissionRequested = false;

const ensureNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (permissionRequested) return Notification.permission;
  permissionRequested = true;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
};

/**
 * Fire an OS-level desktop notification for a booking event. This is
 * the "push" channel (vs the in-app toast rendered below): it surfaces
 * even when Electron is unfocused or covered by another window, which
 * is what the cashier needs during a busy session.
 *
 * Click on the OS notification focuses the Electron window — Electron
 * routes this through the renderer's standard `onclick` handler.
 */
const showNativeBookingNotification = (evt: BookingChangedEvent): void => {
  // Permission ask is async but we want the event handler to return
  // synchronously, so we kick off the permission and fire the
  // notification afterwards. The first event ever may be missed at
  // OS level if permission wasn't yet granted — by design,
  // re-prompting on every event would be far worse UX.
  void ensureNotificationPermission().then((perm) => {
    if (perm !== "granted") return;
    const code = evt.code ?? evt.booking_id;
    const isExtended = evt.kind === "extended";
    const title = isExtended ? `Booking #${code} extended` : `New booking #${code}`;
    const placeFragment = (evt.place_ids ?? []).length > 0
      ? `Place ${(evt.place_ids ?? []).join(", ")}`
      : "";
    const timeFragment = evt.booking_date && evt.start_time
      ? `${evt.booking_date} ${evt.start_time}`
      : "";
    const body = [placeFragment, timeFragment].filter(Boolean).join(" · ");
    try {
      const n = new Notification(title, { body, tag: `booking-${evt.booking_id}` });
      n.onclick = () => {
        // Bring the Electron window to front (handled by Electron's
        // default click behaviour) and let the user click again on the
        // in-app toast to navigate to /bookings/{id}.
        try { window.focus(); } catch { /* not always allowed */ }
      };
    } catch {
      // Some sandboxed Linux WMs (KDE without notification daemon, etc.)
      // throw on Notification construction even if permission says
      // granted. The in-app toast is our floor, so swallow this.
    }
  });
};

/**
 * Map an authenticated user to the most-specific Reverb channel
 * carrying booking events visible to them. Returns `null` when the
 * user lacks the prerequisite scope (e.g. an owner whose
 * `company_id` somehow isn't on the dashboard payload yet) — the
 * notifier safely no-ops in that case.
 */
const resolveBookingChannel = (user: AuthUser | null): string | null => {
  if (!user) return null;
  if (user.role === "admin") return "bookings.global";
  if (user.role === "company_owner") {
    const companyId = user.dashboard?.company_id;
    return typeof companyId === "number" && Number.isFinite(companyId)
      ? `company.${companyId}`
      : null;
  }
  if (user.role === "manager") {
    const branchId = user.dashboard?.branch_id;
    return typeof branchId === "number" && Number.isFinite(branchId)
      ? `branch.${branchId}`
      : null;
  }
  return null;
};

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
  const { refresh: refreshNotifications } = useNotifications();

  const channelName = resolveBookingChannel(user);

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
    // OS-level push notification (Electron exposes the standard HTML5
    // Notification API in the renderer). The cashier sees this even if
    // the app is in the background or behind another window — which is
    // exactly the "real push" behaviour requested. Falls back silently
    // when the user denied permission or the platform doesn't expose
    // Notification (some Linux WMs without notification daemon).
    showNativeBookingNotification(evt);
    // Pull the freshly-written database notification row so the
    // sidebar badge and Notifications screen reflect it without
    // waiting for the 60s polling tick.
    void refreshNotifications();
  }, [refreshNotifications]);

  useBookingChanged(channelName, handleEvent);

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
