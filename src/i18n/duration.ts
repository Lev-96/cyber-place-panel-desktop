/**
 * "1 h 12 min 08 s" → "12 min 07 s" → "59 s" → "0 s": a time left, in the
 * panel's own short units (2026-10-07). Larger units drop away as they reach
 * zero; once a larger unit is shown, the smaller ones keep two digits.
 */
export const formatRemaining = (totalSeconds: number, t: (key: string) => string): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = t("time.hourShort");
  const m = t("time.minShort");
  const sec = t("time.secShort");

  if (hours > 0) return `${hours} ${h} ${pad(minutes)} ${m} ${pad(seconds)} ${sec}`;
  if (minutes > 0) return `${minutes} ${m} ${pad(seconds)} ${sec}`;
  return `${seconds} ${sec}`;
};
