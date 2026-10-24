/**
 * Where and how big the main window opens (2026-10-25).
 *
 * The window was always resizable; what it lacked was memory. It opened at
 * the default every launch, so a cashier who sized it to half a screen beside
 * a second program had to do it again each morning. The last size and place
 * are now kept in the app's own key-value file (`Store`, the one the token
 * lives in) and restored — but only where they still make sense: a monitor
 * unplugged since, or a resolution lowered, must never open the panel off
 * screen or larger than the screen it lands on.
 *
 * Pure functions, so the rules are testable without Electron.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SavedWindow extends Rect {
  maximized: boolean;
}

/** The smallest content the panel is laid out for: every screen reflows at this size. */
export const MIN_CONTENT = { width: 800, height: 560 } as const;

export const WINDOW_STATE_KEY = "window.state";

/** At least this much of the window must lie on a display for the place to be kept. */
const MIN_VISIBLE = 120;

const isRect = (v: unknown): v is Rect =>
  typeof v === "object" && v !== null
  && ["x", "y", "width", "height"].every((k) => Number.isFinite((v as Record<string, unknown>)[k]));

/** The saved state, or null for nothing saved or anything unreadable. */
export const parseSavedWindow = (raw: string | null): SavedWindow | null => {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!isRect(v)) return null;
    return {
      x: Math.round(v.x), y: Math.round(v.y),
      width: Math.round(v.width), height: Math.round(v.height),
      maximized: (v as unknown as SavedWindow).maximized === true,
    };
  } catch {
    return null;
  }
};

const overlap = (a: Rect, b: Rect): number => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/**
 * The saved bounds fitted to the displays there are NOW, or null to open at
 * the default. Kept on the display it overlaps most, shrunk to that display's
 * work area if it no longer fits, and moved back inside it. A window that
 * barely touches any display (its monitor is gone) is not restored at all.
 */
export const restoredBounds = (saved: SavedWindow | null, workAreas: Rect[]): SavedWindow | null => {
  if (saved === null || workAreas.length === 0) return null;

  const best = workAreas
    .map((area) => ({ area, shared: overlap(saved, area) }))
    .sort((a, b) => b.shared - a.shared)[0];
  if (best.shared < MIN_VISIBLE * MIN_VISIBLE) return null;

  const { area } = best;
  const width = Math.max(MIN_CONTENT.width, Math.min(saved.width, area.width));
  const height = Math.max(MIN_CONTENT.height, Math.min(saved.height, area.height));
  const x = Math.min(Math.max(saved.x, area.x), area.x + area.width - width);
  const y = Math.min(Math.max(saved.y, area.y), area.y + area.height - height);

  return { x, y, width, height, maximized: saved.maximized };
};
