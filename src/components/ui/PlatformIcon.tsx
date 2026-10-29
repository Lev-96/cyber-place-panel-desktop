import { platformIconKind, type PlatformIconKind } from "@/utils/platform";
import { useId } from "react";

interface Props {
  /** Any platform slug: pc, ps4, ps5, or a venue's own (poker, table-tennis…). */
  platform: string | null | undefined;
  size?: number;
  /**
   * "brand" fills it with the cyan → magenta gradient (lists, where it stands
   * alone); "current" takes the text colour (inside a button, so it follows the
   * button's own pressed / idle colours).
   */
  tone?: "brand" | "current";
}

/** One shape per kind, drawn in a 24×24 box; `fill` is the paint to use. */
const GLYPHS: Record<PlatformIconKind, (fill: string) => React.ReactNode> = {
  // Windows: four panes in perspective.
  pc: (fill) => (
    <path
      fill={fill}
      d="M2 4.6l8.2-1.1v7.9H2V4.6zm9.2-1.3L22 1.8v9.6H11.2V3.3zM2 12.4h8.2v7.9L2 19.2v-6.8zm9.2 0H22v9.7l-10.8-1.5v-8.2z"
    />
  ),
  // PlayStation mark (same path as the mobile app's PSIcon, re-boxed).
  ps: (fill) => (
    <path
      fill={fill}
      transform="translate(0 2.5)"
      d="M8.365 14.59l-.028 1.863s-1.125.59-3.634.562c-2.51-.03-4.73-.74-4.703-2.28.029-1.54 4.154-3.227 8.307-3.936v2.16l-4.413 1.183s-.755.98.26 1.007c2.31.068 4.211-.56 4.211-.56zm6.432-5.121s.634 1.067 2.308.888c.598-.064 2.306-2.25 1.21-5.623C17.22 1.362 9.259 0 9.259 0v17.402L12.92 19l.058-15.746 1.817.77.001 5.445zm3.72 1.953s-2.42.12-4.614 1.095c-.02.01 0 1.836 0 1.836l5.567-1.331 1.962.887-7.556 2.695v2.04s8.623-2.84 9.893-3.934c1.266-1.098-2.973-3.82-5.251-3.288z"
    />
  ),
  // A spade.
  poker: (fill) => (
    <path
      fill={fill}
      d="M12 2.2c-1.2 2.4-3.5 4.3-5.6 6C4.6 9.6 3.5 11 3.5 13c0 2.5 2 4.3 4.3 4.3 1.3 0 2.4-.5 3.1-1.3-.2 1.7-.9 3.4-2.3 5h6.8c-1.4-1.6-2.1-3.3-2.3-5 .7.8 1.8 1.3 3.1 1.3 2.3 0 4.3-1.8 4.3-4.3 0-2-1.1-3.4-2.9-4.8-2.1-1.7-4.4-3.6-5.6-6z"
    />
  ),
  // A solid paddle with its handle, and the ball (solid, so it never reads as
  // a magnifying glass).
  "table-tennis": (fill) => (
    <g fill={fill}>
      <circle cx={10} cy={9.5} r={7} />
      <path d="M13.2 14.6l2.2-2.2 5.2 5.2a1.55 1.55 0 01-2.2 2.2l-5.2-5.2z" />
      <circle cx={19.6} cy={4.4} r={2.1} />
    </g>
  ),
  // The eight ball.
  billiards: (fill) => (
    <g>
      <circle cx={12} cy={12} r={9.5} fill={fill} />
      <circle cx={12} cy={10.5} r={4.4} fill="var(--color-bg)" />
      {/* The "8" as two rings — shapes, not text, so it never joins the
          label's text content. */}
      <circle cx={12} cy={8.9} r={1.25} fill="none" stroke={fill} strokeWidth={1.1} />
      <circle cx={12} cy={11.9} r={1.55} fill="none" stroke={fill} strokeWidth={1.1} />
    </g>
  ),
  // A headset with two lenses.
  vr: (fill) => (
    <g fill="none" stroke={fill} strokeWidth={1.8} strokeLinejoin="round">
      <path d="M3 8.5c0-1.4 1.1-2.5 2.5-2.5h13c1.4 0 2.5 1.1 2.5 2.5v6c0 1.4-1.1 2.5-2.5 2.5h-3.2l-1.6-2.4a2 2 0 00-3.4 0L8.7 17H5.5C4.1 17 3 15.9 3 14.5v-6z" />
      <circle cx={8} cy={11.5} r={1.6} fill={fill} stroke="none" />
      <circle cx={16} cy={11.5} r={1.6} fill={fill} stroke="none" />
    </g>
  ),
  // Neutral mark: four tiles, "a place to play" with no claim about what.
  other: (fill) => (
    <g fill="none" stroke={fill} strokeWidth={1.7}>
      <rect x={3} y={3} width={7.5} height={7.5} rx={2} />
      <rect x={13.5} y={3} width={7.5} height={7.5} rx={2} />
      <rect x={3} y={13.5} width={7.5} height={7.5} rx={2} />
      <rect x={13.5} y={13.5} width={7.5} height={7.5} rx={3.75} fill={fill} />
    </g>
  ),
};

/**
 * The icon for a platform, chosen by `platformIconKind` (PC → Windows, any
 * PlayStation → its mark, a venue's own platform by the words in its slug,
 * else the neutral mark). Decorative: the platform's NAME beside it is what is
 * read out, so the icon is hidden from assistive tech.
 */
const PlatformIcon = ({ platform, size = 18, tone = "brand" }: Props) => {
  const gradientId = `cp-platform-${useId().replace(/:/g, "")}`;
  const fill = tone === "brand" ? `url(#${gradientId})` : "currentColor";
  const kind = platformIconKind(platform);

  return (
    <svg
      className="platform-icon"
      data-kind={kind}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {tone === "brand" && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="12" x2="24" y2="12" gradientUnits="userSpaceOnUse">
            {/* The theme's own tokens, so a light theme repaints it too. */}
            <stop style={{ stopColor: "var(--color-primary)" }} />
            <stop offset="0.5" style={{ stopColor: "var(--color-accent-blue)" }} />
            <stop offset="1" style={{ stopColor: "var(--color-accent-purple)" }} />
          </linearGradient>
        </defs>
      )}
      {GLYPHS[kind](fill)}
    </svg>
  );
};

export default PlatformIcon;
