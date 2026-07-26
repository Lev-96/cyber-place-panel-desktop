import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { notify, type ToastEvent } from "@/ui/notify";
import { useLang } from "@/i18n/LanguageContext";

/**
 * Global CRUD toaster. One instance mounted at the app root subscribes to
 * {@link notify} and renders stacked toasts in the top-right corner —
 * green for a successful create/update, red for a delete or a failure.
 * Each toast auto-dismisses; clicking one closes it early. Independent of
 * {@link UpdatesToast} (that one is the "new app version" banner).
 */

const AUTO_DISMISS_MS = 3800;

const Toaster = () => {
  const { t } = useLang();
  const [items, setItems] = useState<ToastEvent[]>([]);

  useEffect(() => {
    return notify.subscribe((e) => {
      setItems((cur) => [...cur, e]);
      window.setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== e.id));
      }, AUTO_DISMISS_MS);
    });
  }, []);

  const dismiss = (id: number) => setItems((cur) => cur.filter((x) => x.id !== id));

  // Entity-specific message ("toast.place.created") with a graceful
  // fallback to the generic action message ("toast.generic.created").
  // `t()` returns the key itself when a translation is missing, which is
  // how we detect the entity key is absent and fall back.
  const message = (e: ToastEvent): string => {
    if (e.text) return e.text; // raw-text toast (former alert())
    const specificKey = `toast.${e.entity}.${e.action}`;
    const specific = t(specificKey);
    if (specific !== specificKey) return specific;
    return t(`toast.generic.${e.action}`);
  };

  if (items.length === 0) return null;

  return createPortal(
    <div className="cp-toaster" aria-live="polite">
      {items.map((e) => (
        <div
          key={e.id}
          className={`cp-toast cp-toast-${e.kind}`}
          role="status"
          onClick={() => dismiss(e.id)}
        >
          <span className="cp-toast-icon" aria-hidden>
            {e.kind === "success" ? "✓" : "✕"}
          </span>
          <span className="cp-toast-msg">{message(e)}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
};

export default Toaster;
