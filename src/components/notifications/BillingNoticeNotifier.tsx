import { useAuth } from "@/auth/AuthContext";
import { billingNoticeContent, isPlatformBillingNotice, NOTICE_LANG } from "@/components/platformBilling/billingNotice";
import { useLang } from "@/i18n/LanguageContext";
import { useNotificationsOptional } from "@/notifications/NotificationsContext";
import { playFor } from "@/sound/soundEngine";
import { showDesktopNotification } from "@/utils/desktopNotification";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * A Cyber Place Platform payment notice ARRIVES: ring and raise an OS
 * notification, once (owner, 2026-11-09: the feed showed them in silence).
 *
 * Only what arrives while the panel is open: the notices already in the list
 * when it first loads are the past, not news. The sound is the person's
 * «System» choice (Settings → notification sounds), keyed by the notice's id
 * so a replay or a reconnect is silent; the OS notification is silent too,
 * the panel's own sound is the one that plays. Renders nothing.
 */
const BillingNoticeNotifier = () => {
  const { user } = useAuth();
  const { lang } = useLang();
  const feed = useNotificationsOptional();
  const navigate = useNavigate();
  const seen = useRef<Set<string> | null>(null);
  const userId = user?.id ?? null;

  // A different account starts from its own past.
  useEffect(() => { seen.current = null; }, [userId]);

  useEffect(() => {
    if (!feed || !feed.settled) return;
    const billing = feed.list.filter(isPlatformBillingNotice);
    if (seen.current === null) {
      seen.current = new Set(billing.map((n) => n.id));
      return;
    }
    for (const n of billing) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.read_at !== null) continue;
      playFor("system", n.id);
      const { title, sentence } = billingNoticeContent(n, user?.role === "admin" ? lang : NOTICE_LANG);
      showDesktopNotification(title, { body: sentence, tag: `platform-billing-${n.id}` }, () => {
        try { window.focus(); } catch { /* a window that cannot take focus */ }
        navigate("/notifications");
      });
    }
  }, [feed, feed?.list, feed?.settled, user?.role, lang, navigate]);

  return null;
};

export default BillingNoticeNotifier;
