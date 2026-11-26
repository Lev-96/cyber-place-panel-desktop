import { useAuth } from "@/auth/AuthContext";
import { tagLabel } from "@/components/bonus/ratingTags";
import { useLang } from "@/i18n/LanguageContext";
import { useNotificationsOptional } from "@/notifications/NotificationsContext";
import { playFor } from "@/sound/soundEngine";
import { showDesktopNotification } from "@/utils/desktopNotification";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export const CLUB_RATED = "bonus.club_rated";

/**
 * A player rated the club (2026-11-27, owner; backend `ClubRatedByPlayer`):
 * when the row ARRIVES while the panel is open, ring once (the person's
 * «Гости» sound) and raise an OS notification «★★★★☆ Aram оценил(а) клуб».
 * The rows already in the list when it first loads are the past. Renders
 * nothing; the row itself is drawn by «Уведомления».
 */
const ClubRatedNotifier = () => {
  const { user } = useAuth();
  const { t } = useLang();
  const feed = useNotificationsOptional();
  const navigate = useNavigate();
  const seen = useRef<Set<string> | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => { seen.current = null; }, [userId]);

  useEffect(() => {
    if (!feed || !feed.settled) return;
    const rated = feed.list.filter((n) => n.data?.type === CLUB_RATED);
    if (seen.current === null) {
      seen.current = new Set(rated.map((n) => n.id));
      return;
    }
    for (const n of rated) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.read_at !== null) continue;
      try { playFor("guests", `club-rated:${n.id}`); } catch { /* sound is a courtesy */ }
      const stars = Math.max(0, Math.min(5, Number(n.data?.stars) || 0));
      const name = (n.data?.player_name as string | undefined)?.trim() || "-";
      const title = `${"★".repeat(stars)}${"☆".repeat(5 - stars)} ${t("notifications.clubRatedTitle").replace("{name}", name)}`;
      const tags = Array.isArray(n.data?.tags) ? (n.data.tags as unknown[]).filter((c): c is string => typeof c === "string").map((c) => tagLabel(t, c)) : [];
      const words = (n.data?.comment as string | undefined)?.trim();
      const body = [tags.join(", "), words ? `«${words}»` : ""].filter(Boolean).join(" · ");
      showDesktopNotification(title, { body, tag: `club-rated-${n.id}` }, () => {
        try { window.focus(); } catch { /* a window that cannot take focus */ }
        navigate("/notifications");
      });
    }
  }, [feed, feed?.list, feed?.settled, t, navigate]);

  return null;
};

export default ClubRatedNotifier;
