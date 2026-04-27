export const theme = {
  colors: {
    bg: "#020514",
    surface: "#0b1224",
    surfaceAlt: "#101a35",
    border: "#1f2a44",
    text: "#ffffff",
    muted: "#94a3b8",
    primary: "#07ddf1",
    primaryDim: "#07ddf1cc",
    danger: "#ef4444",
    success: "#22c55e",
    warning: "#f59e0b",
    inactive: "#6b7280",
  },
  radii: { sm: 6, md: 10, lg: 14 },
  spacing: (n: number) => `${n * 4}px`,
} as const;

export type Theme = typeof theme;
