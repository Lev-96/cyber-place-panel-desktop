import type { StatusTone } from "./statusTone";

export type PlaceLiveStatus = "free" | "busy" | "reserved" | "maintenance";

/**
 * The live board in the shared vocabulary (2026-10-27). It used to paint a
 * FREE seat green and a busy one red — the opposite of Active Places, where
 * green is a seat in play. One meaning per colour now, on every board.
 */
export const PLACE_STATUS_TONE: Record<PlaceLiveStatus, StatusTone> = {
  free: "free",
  busy: "playing",
  reserved: "booked",
  maintenance: "offline",
};

export const PlaceStatusColors: Record<PlaceLiveStatus, string> = {
  free: "rgb(var(--status-free-rgb))",
  busy: "rgb(var(--status-playing-rgb))",
  reserved: "rgb(var(--status-booked-rgb))",
  maintenance: "rgb(var(--status-offline-rgb))",
};

export const PlaceStatusLabels: Record<PlaceLiveStatus, string> = {
  free: "Free",
  busy: "Busy",
  reserved: "Reserved",
  maintenance: "Maintenance",
};
