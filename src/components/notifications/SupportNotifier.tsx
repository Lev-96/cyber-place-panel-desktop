import { useLang } from "@/i18n/LanguageContext";
import { useSupportUnread } from "@/support/SupportUnreadContext";
import { playSupportChime } from "@/utils/notificationSound";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * "Support answered you" — the floating card, and the sound with it.
 *
 * Mounted once in the app shell beside `GlobalBookingNotifier`, and built the
 * same way: fixed to the top-right, an accent rail down the left edge, a title,
 * a preview and one action. Support is a different colour from a booking on
 * purpose — the two mean different things and a cashier should not have to read
 * the words to know which arrived.
 *
 * ## One card, not a stack
 * Replies come in bursts — a support admin types three lines in a row — and
 * three cards climbing the screen is worse than one. The newest replaces the
 * one before it and resets the timer, so a burst reads as a single, current
 * notification.
 *
 * ## The sound
 * `playSupportChime`, NOT the app's arpeggio: two soft notes stepping down,
 * the cadence a chat app uses, against the rising "something happened on the
 * floor" of a booking. If the two sounded alike the second one would be
 * ignored along with the first.
 *
 * It fires on ARRIVAL only. The context that feeds this listens to a live
 * channel, which has no history to replay, and dedupes by message id — so
 * opening a thread, restarting the app, reconnecting the socket and sending
 * your own message all produce no arrival and therefore no sound.
 *
 * Autoplay is not a problem here for the reason it is not one for the booking
 * chime: by the time any of this can happen the user has signed in, which is
 * interaction enough for the renderer to hand back a running AudioContext. If
 * it does not, `playSupportChime` swallows it and the card still shows.
 */
const AUTO_DISMISS_MS = 9_000;

const SupportNotifier = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const { arrival, clearArrival } = useSupportUnread();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!arrival) return;

    playSupportChime();
    // Mounted invisible, then flipped on the next frame so the transition has
    // two states to move between — set both at once and it simply appears.
    setVisible(false);
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    // Cleared a beat after the fade so the card is gone before its data is.
    const drop = window.setTimeout(() => clearArrival(), AUTO_DISMISS_MS + 400);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearTimeout(drop);
    };
    // `clearArrival` is stable enough for this to key on the arrival alone;
    // re-running on its identity would restart the timer mid-life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival?.id]);

  if (!arrival) return null;

  const open = () => {
    setVisible(false);
    clearArrival();
    navigate("/support");
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`support-toast${visible ? " is-in" : ""}`}
    >
      <div className="support-toast__title">
        🎧 {t("support.toast.title")}
        {arrival.reference ? ` · ${arrival.reference}` : ""}
      </div>
      <div className="support-toast__sender">{arrival.senderName}</div>
      {arrival.preview && (
        <div className="support-toast__preview">{arrival.preview}</div>
      )}
      <div className="support-toast__actions">
        <button type="button" onClick={open}>{t("support.toast.open")} →</button>
        <button
          type="button"
          className="is-quiet"
          onClick={() => { setVisible(false); clearArrival(); }}
        >
          {t("action.close")}
        </button>
      </div>
    </div>
  );
};

export default SupportNotifier;
