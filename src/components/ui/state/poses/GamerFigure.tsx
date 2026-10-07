import { ReactNode, useId } from "react";

/**
 * The Cyber Place player, drawn by hand: a hooded esports player in a headset,
 * neon line-art over a dark fill, standing on a soft floor glow. Every pose is
 * this figure plus what is in their hands; nothing here is a bitmap, a font or
 * a dependency.
 *
 * Colours are the theme tokens (classes in global.css → "State views"), the
 * outline is the brand gradient cyan → blue → magenta. Motion is CSS only, on
 * `transform` / `opacity`, and switched off under prefers-reduced-motion.
 *
 * Shared by every pose module; each pose is its own lazy chunk, so a screen
 * pays for the one it shows.
 */
export interface GamerFigureProps {
  /** Drawn in front of the body: the controller, the map, the hand with a plug.
   *  Receives the outline paint (the brand gradient) to draw with. */
  front?: (stroke: string) => ReactNode;
  /** Drawn behind / around the figure: wifi arcs, a socket, a question mark. */
  scene?: (stroke: string) => ReactNode;
  /** The mouth path for this pose (the face carries the mood). */
  mouth?: string;
  /** Glances sideways (x px) — the "searching" pose looks at its lens. */
  lookX?: number;
  /** Tilts the head (deg) — the "lost" pose. */
  headTilt?: number;
  /** Extra class for the whole figure group (pose-level motion). */
  motion?: string;
}

export const SMILE = "M113 93 Q120 99 127 93";
export const FLAT = "M114 95 H126";
export const SMALL_O = "M118 95 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0";

export const GamerFigure = ({ front, scene, mouth = SMILE, lookX = 0, headTilt = 0, motion }: GamerFigureProps) => {
  const raw = useId();
  const id = `cpg${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stroke = `url(#${id}-line)`;
  return (
    <svg className="cp-gamer" viewBox="0 0 240 180" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="cp-gamer__stop-a" />
          <stop offset="0.5" className="cp-gamer__stop-b" />
          <stop offset="1" className="cp-gamer__stop-c" />
        </linearGradient>
        <radialGradient id={`${id}-floor`}>
          <stop offset="0" className="cp-gamer__stop-a" stopOpacity="0.45" />
          <stop offset="1" className="cp-gamer__stop-c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="cp-gamer__floor" cx="120" cy="170" rx="78" ry="9" fill={`url(#${id}-floor)`} />
      {scene?.(stroke)}

      <g className={`cp-gamer__sway${motion ? ` ${motion}` : ""}`}>
        <g className="cp-gamer__breathe">
          {/* Hoodie */}
          <path className="cp-gamer__fill" stroke={stroke} strokeWidth="2.5" d="M62 172 C62 134 84 116 120 116 C156 116 178 134 178 172 Z" />
          <path fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" d="M100 119 Q120 136 140 119" />
          <path fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" d="M112 132 V146 M128 132 V146" />

          {/* Head */}
          <g transform={headTilt ? `rotate(${headTilt} 120 104)` : undefined}>
            <circle className="cp-gamer__skin" stroke={stroke} strokeWidth="2.5" cx="120" cy="80" r="26" />
            <path className="cp-gamer__hair" d="M95 74 Q100 52 122 52 Q142 53 146 72 Q134 63 120 65 Q106 66 95 74 Z" />
            <g transform={lookX ? `translate(${lookX} 0)` : undefined}>
              <g className="cp-gamer__eyes">
                <rect className="cp-gamer__eye" x="108" y="78" width="5" height="8" rx="2.5" />
                <rect className="cp-gamer__eye" x="127" y="78" width="5" height="8" rx="2.5" />
              </g>
            </g>
            <path className="cp-gamer__mouth" d={mouth} />
            {/* Headset: band, cups, mic */}
            <path fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" d="M92 82 C90 44 150 44 148 82" />
            <rect className="cp-gamer__cup" x="85" y="73" width="11" height="19" rx="5.5" />
            <rect className="cp-gamer__cup" x="144" y="73" width="11" height="19" rx="5.5" />
            <path fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" d="M91 90 Q95 105 110 105" />
            <circle className="cp-gamer__mic" cx="112" cy="105" r="2.6" />
          </g>

          {front?.(stroke)}
        </g>
      </g>
    </svg>
  );
};

/** A gloved hand: the figure's hands are drawn the same everywhere. */
export const Hand = ({ cx, cy, stroke }: { cx: number; cy: number; stroke: string }) => (
  <circle className="cp-gamer__skin" stroke={stroke} strokeWidth="2" cx={cx} cy={cy} r="6.5" />
);
