export type PlaceLiveStatus = "free" | "busy" | "reserved" | "maintenance";

export const PlaceStatusColors: Record<PlaceLiveStatus, string> = {
  free: "#22c55e",
  busy: "#ef4444",
  reserved: "#f59e0b",
  maintenance: "#6b7280",
};

export const PlaceStatusLabels: Record<PlaceLiveStatus, string> = {
  free: "Free",
  busy: "Busy",
  reserved: "Reserved",
  maintenance: "Maintenance",
};
