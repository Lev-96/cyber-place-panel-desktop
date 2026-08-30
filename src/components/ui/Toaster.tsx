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

  // `t()` returns the key itself when a translation is missing, which is how
  // the fallbacks below detect an absent key.
  const resolve = (key: string): string | null => {
    const value = t(key);
    return value === key ? null : value;
  };

  /**
   * The sentence has to agree with the colour.
   *
   * A failed create used to render the SUCCESS message in a red box — "New
   * place created", with a cross in front of it — because both outcomes were
   * resolved from the same `toast.{entity}.{action}` key and only the styling
   * differed. Somebody reading that is told the opposite of what happened, and
   * red is the easier half to miss.
   *
   * So the two kinds resolve from different key spaces:
   *
   *   success  toast.{entity}.{action}  →  toast.generic.{action}
   *   error    toast.fail.{action}      →  toast.generic.error
   *
   * The failure side is per-ACTION rather than per-entity on purpose: "could
   * not create" reads correctly for every entity, and one key per entity per
   * action per language is a dictionary nobody would keep complete.
   */
  const message = (e: ToastEvent): string => {
    if (e.text) return e.text; // raw-text toast (former alert())

    if (e.kind === "error") {
      return resolve(`toast.fail.${e.action}`) ?? t("toast.generic.error");
    }

    return (
      resolve(`toast.${e.entity}.${e.action}`)
      ?? resolve(`toast.generic.${e.action}`)
      ?? t("toast.generic.saved")
    );
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
