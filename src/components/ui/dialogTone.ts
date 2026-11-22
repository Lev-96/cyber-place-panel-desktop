/**
 * The background tone of a dialog's card, by what the dialog is for
 * (2026-11-22, owner): a cashier tells at a glance which window is open.
 *
 *  - `start`  — starting a seat: the accent (blue/cyan) tint;
 *  - `bill`   — a receipt / final bill: the success (green) tint;
 *  - `unpaid` — an unpaid reminder: the warning (amber) tint;
 *  - `goods`  — products on a seat: the purple tint.
 *
 * Drawn by `.dialog-tone--*` in global.css as a `color-mix` of the theme's own
 * accent with `--color-surface`, so every theme (dark, light, contrast and the
 * soft ones) keeps its contrast: the text colours stay the theme's.
 */
export type DialogTone = "start" | "bill" | "unpaid" | "goods";

/** The class pair for a card: `dialog-tone dialog-tone--{tone}`. */
export const dialogToneClass = (tone: DialogTone): string => `dialog-tone dialog-tone--${tone}`;
