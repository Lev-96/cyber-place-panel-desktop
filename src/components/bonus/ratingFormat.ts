import type { IRating } from "@/types/bonus";

/**
 * How many ratings, short (2026-11-27, owner): 999 as it is, 1 000 → «1K»,
 * 1 500 → «1.5K», 1 000 000 → «1M». One decimal, none when it is whole.
 */
export const compactCount = (n: number): string => {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  const short = (x: number, unit: string) => {
    const r = Math.floor(x * 10) / 10;
    return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}${unit}`;
  };
  if (v >= 1_000_000) return short(v / 1_000_000, "M");
  if (v >= 1_000) return short(v / 1_000, "K");
  return String(v);
};

/** «4.5» or null while nobody has rated. */
export const ratingAverage = (r: IRating | null | undefined): string | null =>
  r && r.average !== null && r.count > 0 ? r.average : null;
