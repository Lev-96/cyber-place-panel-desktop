import { useAuth } from "@/auth/AuthContext";
import { asPanelUpdate, panelUpdateText, pendingPanelUpdate, updatesRouteFor } from "@/components/updates/panelUpdate";
import { useLang } from "@/i18n/LanguageContext";
import { useNotificationsOptional } from "@/notifications/NotificationsContext";
import { playFor } from "@/sound/soundEngine";
import "@/types/desktopUpdates";
import { showDesktopNotification } from "@/utils/desktopNotification";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * "A new Cyber Place version is out" where a person sees it (2026-11-20,
 * owner: a manager never noticed a release — the server's notice was a row in
 * the bell, nothing more).
 *
 * The card IS the server's notification (`PanelUpdateAvailable`, written for
 * every owner / manager / admin when a version is promoted), the
 * SessionReminderNotifier idiom: it arrives with the feed — on start, over
 * Reverb, after a reconnect — so nothing here decides that a release exists.
 * Said in the panel's language from the row's data, never the stored English
 * sentence: «Новая версия Cyber Place 1.0.68 · Откройте раздел «Обновление» и
 * нажмите «Проверить обновления».», with «Открыть Обновление» and «Позже».
 *
 *  - «Открыть Обновление»: every waiting update notice is read (the newest
 *    supersedes the rest) and «Обновление» opens;
 *  - «Позже»: hidden for this run only, so the next start or sign-in asks
 *    again while the notice is unread;
 *  - arriving while the panel is open: the «System» sound and a silent OS
 *    notification, once per notice. Rows already in the list at start ring
 *    once too (the card is new to this run) but raise no OS notification.
 *
 * Desktop only: the owner web has no installer and is always the newest. A
 * notice for the version this desktop already runs says nothing.
 */
const PanelUpdateNotifier = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const feed = useNotificationsOptional();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const bridge = typeof window !== "undefined" ? window.cyberplaceUpdates : undefined;
  const [installed, setInstalled] = useState<string | null>(null);
  const [putOff, setPutOff] = useState<ReadonlySet<string>>(() => new Set());
  // Ids in the list when it first settled: the past, not an arrival.
  const known = useRef<Set<string> | null>(null);
  const userId = user?.id ?? null;

  // A different account starts from its own past and its own «Позже».
  useEffect(() => {
    known.current = null;
    setPutOff(new Set());
  }, [userId]);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    bridge.getState().then((s) => { if (alive && s?.currentVersion) setInstalled(s.currentVersion); }).catch(() => { /* main process logs it */ });
    return () => { alive = false; };
  }, [bridge]);

  const list = useMemo(() => feed?.list ?? [], [feed?.list]);
  const notice = useMemo(() => (bridge ? pendingPanelUpdate(list, putOff, installed) : null), [bridge, list, putOff, installed]);
  const target = updatesRouteFor(user?.role);
  const text = notice ? panelUpdateText(notice.version, t) : null;

  // Arrivals: the OS notification for a notice the panel heard while open.
  useEffect(() => {
    if (!bridge || !feed?.settled) return;
    const ids = list.filter((n) => asPanelUpdate(n) !== null).map((n) => n.id);
    if (known.current === null) {
      known.current = new Set(ids);
      return;
    }
    for (const id of ids) {
      if (known.current.has(id)) continue;
      known.current.add(id);
      if (!notice || notice.id !== id || !text) continue;
      showDesktopNotification(text.title, { body: text.body, tag: `panel-update-${id}` }, () => {
        try { window.focus(); } catch { /* a window that cannot take focus */ }
        navigate(target);
      });
    }
  }, [bridge, feed?.settled, list, notice, text, navigate, target]);

  // The update ding, as the person set it; the engine plays a key once.
  useEffect(() => {
    if (notice) playFor("system", `panel-update:${notice.id}`);
  }, [notice]);

  if (!notice || !text || pathname === target) return null;

  /** Every unread update notice: the one shown supersedes older ones. */
  const waitingIds = () => list.filter((n) => n.read_at === null && asPanelUpdate(n) !== null).map((n) => n.id);

  const later = () => {
    setPutOff((cur) => new Set([...cur, ...waitingIds()]));
  };

  const open = () => {
    const ids = waitingIds();
    setPutOff((cur) => new Set([...cur, ...ids]));
    for (const id of ids) void feed?.markRead(id).catch(() => { /* the feed re-reads on its own */ });
    navigate(target);
  };

  return (
    <div className="ending-soon-stack reminder-stack panel-update-stack">
      <div role="status" aria-live="polite" className="ending-soon-card reminder-card" data-testid="panel-update-card">
        <div className="reminder-card__title">🎉 {text.title}</div>
        <div className="reminder-card__body">{text.body}</div>
        <div className="reminder-card__actions">
          <button type="button" className="ending-soon-card__action" onClick={open} data-testid="panel-update-open">
            {t("panelUpdate.open")}
          </button>
          <button type="button" className="ending-soon-card__action is-secondary" onClick={later} data-testid="panel-update-later">
            {t("ownUpdates.later")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PanelUpdateNotifier;
