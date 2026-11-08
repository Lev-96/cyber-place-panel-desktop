import { fmt } from "@/i18n/translations";
import type { UiPreferences } from "@/preferences/uiPreferences";

/**
 * «Мой интерфейс» in a few words (2026-11-03), for its card among the
 * ready-made ones: what the person SAVED (pass the saved preferences, not a
 * draft), so the card shows what choosing it brings back. Only what differs
 * from the plain defaults is spelled out, joined by " · ".
 */
export const interfaceSummary = (p: UiPreferences, t: (key: string) => string): string => {
  const l = p.layout;
  const b = p.board;
  const parts = [
    t(l.board_view === "list" ? "appearance.custom.list" : "appearance.custom.grid"),
    fmt(t("appearance.summary.cards"), t(`appearance.custom.size${l.card_size.toUpperCase()}`)),
  ];
  if (l.button_labels === "icons") parts.push(t("appearance.summary.labelsIcons"));
  if (l.button_labels === "text") parts.push(t("appearance.summary.labelsText"));
  if (b.gap_y !== null) parts.push(fmt(t("appearance.summary.rowGap"), fmt(t("appearance.cards.px"), b.gap_y)));
  if (l.sidebar.length > 0) parts.push(t("appearance.summary.menu"));
  return parts.join(" · ");
};
