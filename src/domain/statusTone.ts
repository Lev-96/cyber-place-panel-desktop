/**
 * One vocabulary for the state of a seat, on every board (2026-10-27).
 *
 * Green used to mean "taken" on Active Places and "free" on Places / Live, and
 * amber ("booked") sat at 1.06:1 against that green — the same colour to a
 * colour-blind cashier. Every board now maps its own states onto these tones,
 * and a tone is always a colour AND an icon AND a word (`StatusChip`), never
 * colour alone. The colours are the theme's (`--status-<tone>-*` in
 * global.css), so a theme changes them in one place.
 */
export type StatusTone = "free" | "playing" | "booked" | "ending" | "critical" | "paused" | "offline";

export interface ToneLook {
  fg: string;
  bg: string;
  border: string;
}

const TOKEN: Record<StatusTone, string> = {
  free: "free",
  playing: "playing",
  booked: "booked",
  ending: "ending",
  critical: "critical",
  // A paused seat is quiet, not alarming: the offline greys.
  paused: "offline",
  offline: "offline",
};

export const toneLook = (tone: StatusTone): ToneLook => ({
  fg: `var(--status-${TOKEN[tone]}-fg)`,
  bg: `var(--status-${TOKEN[tone]}-bg)`,
  border: `var(--status-${TOKEN[tone]}-border)`,
});
