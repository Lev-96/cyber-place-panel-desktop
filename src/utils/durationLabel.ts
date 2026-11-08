/** "20 мин", "1 ч", "1 ч 30 мин" — a length in minutes in the panel's words (shared, 2026-11-07). */
export const durationLabel = (minutes: number, t: (k: string) => string): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} ${t("time.minShort")}`;
  return m === 0 ? `${h} ${t("time.hourShort")}` : `${h} ${t("time.hourShort")} ${m} ${t("time.minShort")}`;
};
