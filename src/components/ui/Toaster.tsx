import { useCallback, useEffect, useState } from "react";
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

/**
 * Long enough to read two lines in three languages without being long enough
 * to pile up. Armenian runs longest, and 3.8s was measured short for it.
 */
const AUTO_DISMISS_MS = 5000;

/** Must match the `cp-toast-out` keyframes; the node is removed after it. */
const LEAVE_MS = 220;

const Toaster = () => {
  const { t } = useLang();
  const [items, setItems] = useState<ToastEvent[]>([]);
  /**
   * Ids on their way out.
   *
   * A toast used to vanish on the frame its timer fired, and with several on
   * screen the ones below jumped up to fill the gap. Marking it first lets CSS
   * fade and collapse it, and the node is dropped once that has played.
   */
  const [leaving, setLeaving] = useState<number[]>([]);

  const remove = useCallback((id: number) => {
    setLeaving((cur) => (cur.includes(id) ? cur : [...cur, id]));
    window.setTimeout(() => {
      setItems((cur) => cur.filter((x) => x.id !== id));
      setLeaving((cur) => cur.filter((x) => x !== id));
    }, LEAVE_MS);
  }, []);

  useEffect(() => {
    return notify.subscribe((e) => {
      setItems((cur) => [...cur, e]);
      window.setTimeout(() => remove(e.id), AUTO_DISMISS_MS);
    });
  }, [remove]);

  const dismiss = (id: number) => remove(id);

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

    // A warning always carries its own text — `notify.warning(text)` is the
    // only way to raise one, and the cause is too specific for a stable key
    // ("seat №6 is no longer free"). This is the belt-and-braces branch for a
    // text-less one, which the API does not allow but the type does.
    if (e.kind === "warning") return t("toast.generic.error");

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
          className={`cp-toast cp-toast-${e.kind}${leaving.includes(e.id) ? " cp-toast-leaving" : ""}`}
          role={e.kind === "success" ? "status" : "alert"}
          onClick={() => dismiss(e.id)}
        >
          <span className="cp-toast-icon" aria-hidden>
            {e.kind === "success" ? "✓" : e.kind === "warning" ? "!" : "✕"}
          </span>
          <span className="cp-toast-msg">{message(e)}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
};

export default Toaster;
