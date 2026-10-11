import { ReactNode, useId } from "react";

/**
 * The Cyber Place player: a young gamer in a headset and hoodie, drawn as a
 * bust behind the glowing edge of their desk. Every pose is this figure plus
 * a face (brows, mouth, lids) and what is in their hands; nothing here is a
 * bitmap, a font or a dependency.
 *
 * Light: a soft brand-gradient backlight behind the head, cyan rim light on
 * the left edge and magenta on the right (the room's neon), the desk edge in
 * the brand gradient. Colours come from CSS — the UI tokens plus the
 * illustration palette scoped to `.cp-gamer` (skin, hair, fabric, gear) in
 * global.css → "State views". Motion is CSS only, on `transform` / `opacity`,
 * in loops of different lengths so the layers never line up, and none at all
 * under prefers-reduced-motion.
 *
 * Shared by every pose module; each pose is its own lazy chunk, so a screen
 * pays for the one it shows.
 */

/** Gradient references for drawing props in the same light as the figure. */
export interface GamerPaint {
  skin: string;
  hoodie: string;
  gear: string;
  rim: string;
  line: string;
}

export interface GamerFace {
  /** Both brows in one path (left brow, then `M` right brow). */
  brows: string;
  /** The mouth, drawn with the `cp-gamer__mouth` / `__teeth` / `__tongue` / `__lip` classes. */
  mouth: ReactNode;
  /** `sleepy` = heavy upper lids; `smiling` = cheeks pushing the lower lids up. */
  lids?: "sleepy" | "smiling";
  /** Where the eyes rest (x px); the idle glance moves around it. */
  look?: number;
}

export interface GamerFigureProps {
  face: GamerFace;
  /** Sleeves, drawn behind the desk edge (forearms rise from below it). */
  arms?: (paint: GamerPaint) => ReactNode;
  /** In front of the desk: hands and what they hold. */
  front?: (paint: GamerPaint) => ReactNode;
  /** Behind the figure: a socket, a Wi-Fi sign, a question mark, sparkles. */
  scene?: (paint: GamerPaint) => ReactNode;
  /** Static head tilt (deg) — the "lost" pose. */
  headTilt?: number;
  /** Replaces the idle head motion (e.g. the sleepy nod). */
  headMotion?: string;
}

const EYE_Y = 80;

/** One `<stop>` painted by a palette class (`.cp-gamer__s-*` in global.css). */
const Stop = ({ o, c, a }: { o: number; c: string; a?: number }) => (
  <stop offset={o} className={`cp-gamer__s-${c}`} stopOpacity={a} />
);

const Eye = ({ cx, clip, iris }: { cx: number; clip: string; iris: string }) => (
  <g>
    <ellipse className="cp-gamer__white" cx={cx} cy={EYE_Y} rx="4.9" ry="5.6" />
    <g clipPath={`url(#${clip})`}>
      <g className="cp-gamer__iris">
        <circle fill={iris} cx={cx} cy={EYE_Y + 0.8} r="3.7" />
        <circle className="cp-gamer__pupil" cx={cx} cy={EYE_Y + 0.8} r="1.8" />
        <circle className="cp-gamer__catch" cx={cx - 1.3} cy={EYE_Y - 0.8} r="1.15" />
        <path className="cp-gamer__reflect" d={`M${cx - 2.2} ${EYE_Y + 3} Q${cx} ${EYE_Y + 4.4} ${cx + 2.4} ${EYE_Y + 2.6}`} />
      </g>
    </g>
    <path className="cp-gamer__lash" d={`M${cx - 5.6} ${EYE_Y - 0.6} Q${cx - 1} ${EYE_Y - 7.4} ${cx + 5.4} ${EYE_Y - 1.6}`} />
  </g>
);

export const GamerFigure = ({ face, arms, front, scene, headTilt = 0, headMotion }: GamerFigureProps) => {
  const raw = useId();
  const id = `cpg${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const url = (n: string) => `url(#${id}-${n})`;
  const paint: GamerPaint = { skin: url("skin"), hoodie: url("hoodie"), gear: url("gear"), rim: url("rim"), line: url("line") };
  const head = `cp-gamer__head${headMotion ? ` ${headMotion}` : ""}`;
  const tilt = headTilt ? `rotate(${headTilt} 120 112)` : undefined;
  const look = face.look ? `translate(${face.look} 0)` : undefined;
  return (
    <svg className="cp-gamer" viewBox="0 0 240 180" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="1">
          <Stop o={0} c="a" />
          <Stop o={0.5} c="b" />
          <Stop o={1} c="c" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <Stop o={0} c="a" a={0.2} />
          <Stop o={0.55} c="c" a={0.07} />
          <Stop o={1} c="c" a={0} />
        </radialGradient>
        <radialGradient id={`${id}-skin`} cx="0.4" cy="0.32" r="0.75">
          <Stop o={0} c="skin-hi" />
          <Stop o={0.55} c="skin" />
          <Stop o={1} c="skin-lo" />
        </radialGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="0.4" y2="1">
          <Stop o={0} c="hair-hi" />
          <Stop o={0.6} c="hair" />
        </linearGradient>
        <linearGradient id={`${id}-hoodie`} x1="0" y1="112" x2="0" y2="170" gradientUnits="userSpaceOnUse">
          <Stop o={0} c="cloth-hi" />
          <Stop o={0.45} c="cloth" />
          <Stop o={1} c="cloth-lo" />
        </linearGradient>
        <linearGradient id={`${id}-gear`} x1="0" y1="0" x2="0" y2="1">
          <Stop o={0} c="gear-hi" />
          <Stop o={1} c="gear-lo" />
        </linearGradient>
        <linearGradient id={`${id}-rim`}>
          <Stop o={0} c="a" a={0.55} />
          <Stop o={0.24} c="a" a={0} />
          <Stop o={0.76} c="c" a={0} />
          <Stop o={1} c="c" a={0.5} />
        </linearGradient>
        <radialGradient id={`${id}-iris`} cx="0.5" cy="0.4" r="0.6">
          <Stop o={0} c="iris-hi" />
          <Stop o={1} c="iris" />
        </radialGradient>
        <linearGradient id={`${id}-desk`} x1="0" y1="0" x2="0" y2="1">
          <Stop o={0} c="desk" />
          <Stop o={0.8} c="desk" />
          <Stop o={1} c="desk" a={0} />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="24" x2="216" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <Stop o={0} c="a" a={0} />
          <Stop o={0.2} c="a" />
          <Stop o={0.5} c="b" />
          <Stop o={0.8} c="c" />
          <Stop o={1} c="c" a={0} />
        </linearGradient>
        <clipPath id={`${id}-el`}>
          <ellipse cx="110" cy={EYE_Y} rx="4.9" ry="5.6" />
        </clipPath>
        <clipPath id={`${id}-er`}>
          <ellipse cx="130" cy={EYE_Y} rx="4.9" ry="5.6" />
        </clipPath>
      </defs>

      {/* Backlight: the room's neon behind the player. */}
      <circle cx="120" cy="96" r="88" fill={url("glow")} />
      {scene?.(paint)}

      <g className="cp-gamer__sway">
        {/* Neck: moves with the head, tucked under the collar. */}
        <g className={head}>
          <g transform={tilt}>
            <path fill={paint.skin} d="M110 96 V124 H130 V96 Z" />
            <path className="cp-gamer__shadow" d="M110 104 Q120 112 130 104 V112 Q120 118 110 112 Z" />
          </g>
        </g>

        {/* Hoodie: body, hood rim, strings, folds, rim light, neon trim. */}
        <g className="cp-gamer__breathe">
          <path fill={paint.hoodie} d="M54 172 C54 144 72 127 99 120 Q120 131 141 120 C168 127 186 144 186 172 Z" />
          <path className="cp-gamer__fold" d="M80 146 Q86 154 84 166 M160 146 Q154 154 156 166 M106 150 Q112 158 110 168" />
          <path
            className="cp-gamer__hood"
            d="M96 119 C100 113 108 112 112 116 Q120 124 128 116 C132 112 140 113 144 119 C140 130 130 136 120 136 C110 136 100 130 96 119 Z"
          />
          <path className="cp-gamer__hood-in" d="M103 120 Q120 133 137 120" />
          <path className="cp-gamer__string" d="M113 133 Q111 142 112 150 M127 133 Q129 141 128 148" />
          <rect className="cp-gamer__aglet" x="110.4" y="149" width="3.2" height="5" rx="1.4" />
          <rect className="cp-gamer__aglet" x="126.6" y="147" width="3.2" height="5" rx="1.4" />
          <path fill={paint.rim} d="M54 172 C54 144 72 127 99 120 Q120 131 141 120 C168 127 186 144 186 172 Z" />
          <path fill="none" stroke={paint.line} strokeWidth="1.3" strokeOpacity="0.75" d="M54 170 C54 144 72 127 99 120 M141 120 C168 127 186 144 186 170" />
        </g>

        {/* Head */}
        <g className={head}>
          <g transform={tilt}>
            <path
              fill={url("hair")}
              d="M90 84 C84 62 94 44 112 39.6 L116 33.4 L121 38.4 L128 34.6 L129.6 39.6 C146 42 157 60 151 84 C149 92 146 95 143 96 L97 96 C94 95 91 92 90 84 Z"
            />
            <path fill={paint.skin} d="M96 77 C96 60 106 51 120 51 C134 51 144 60 144 77 C144 94 134 108 120 108 C106 108 96 94 96 77 Z" />
            <path fill={paint.rim} opacity="0.4" d="M96 77 C96 60 106 51 120 51 C134 51 144 60 144 77 C144 94 134 108 120 108 C106 108 96 94 96 77 Z" />
            <ellipse className="cp-gamer__blush" cx="104" cy="91" rx="4.6" ry="2.4" />
            <ellipse className="cp-gamer__blush" cx="136" cy="91" rx="4.6" ry="2.4" />
            <path className="cp-gamer__nose" d="M120.5 84 Q118 91 121 92.2" />

            <g transform={look}>
              <g className="cp-gamer__eyes">
                <Eye cx={110} clip={`${id}-el`} iris={url("iris")} />
                <Eye cx={130} clip={`${id}-er`} iris={url("iris")} />
                {face.lids === "sleepy" && (
                  <path
                    fill={paint.skin}
                    className="cp-gamer__lid"
                    d="M104.6 81 Q110 73 115.4 81 Q110 79.6 104.6 81 Z M124.6 81 Q130 73 135.4 81 Q130 79.6 124.6 81 Z"
                  />
                )}
                {face.lids === "smiling" && (
                  <path fill={paint.skin} d="M104.4 86.4 Q110 80.6 115.6 86.4 Z M124.4 86.4 Q130 80.6 135.6 86.4 Z" />
                )}
              </g>
            </g>
            <path className="cp-gamer__brow" d={face.brows} />
            {face.mouth}

            {/* Fringe: swept to one side, with a magenta streak. */}
            <path
              fill={url("hair")}
              d="M94 76 C91 54 105 42 122 42 C139 42 150 53 147 72 C144 64 139 60 133 58 C131 64 126 67 120 67 C122 63 122 60 121 57 C114 63 104 66 94 76 Z"
            />
            <path className="cp-gamer__streak" d="M100 66 C106 57 114 52 122 50" />
            <path className="cp-gamer__strand" d="M108 47 C116 43.6 128 43.6 136 47.6 M138 52 C142 55 145 59 146 64" />

            {/* Headset: band, cups with LED rims, mic. */}
            <path className="cp-gamer__band" d="M92 80 C88 44 152 44 148 80" />
            <path className="cp-gamer__band-hi" d="M95 68 C96 50 144 50 145 68" />
            <rect fill={paint.gear} x="85" y="70" width="13" height="24" rx="6.5" />
            <rect fill={paint.gear} x="142" y="70" width="13" height="24" rx="6.5" />
            <path className="cp-gamer__led cp-gamer__led--a" d="M86.6 75 Q85 82 86.6 89" />
            <path className="cp-gamer__led cp-gamer__led--c" d="M153.4 75 Q155 82 153.4 89" />
            <path className="cp-gamer__boom" d="M91 92 Q93 104 106 104.5" />
            <rect fill={paint.gear} x="104" y="101.8" width="7" height="5.4" rx="2.7" />
            <circle className="cp-gamer__mic" cx="110" cy="104.5" r="1.3" />
          </g>
        </g>
        {arms?.(paint)}
      </g>

      {/* Desk edge: crops the bust, carries the brand gradient. */}
      <path fill={url("desk")} d="M24 166 H216 L226 180 H14 Z" />
      <path fill="none" stroke={url("edge")} strokeWidth="2" d="M24 166 H216" />

      <g className="cp-gamer__sway">{front?.(paint)}</g>
    </svg>
  );
};

/** A sleeve: the hoodie's fabric with the same neon trim as the body. */
export const Arm = ({ d, paint }: { d: string; paint: GamerPaint }) => (
  <g>
    <path fill="none" stroke={paint.line} strokeOpacity="0.7" strokeWidth="16.4" strokeLinecap="round" d={d} />
    <path fill="none" stroke={paint.hoodie} strokeWidth="14" strokeLinecap="round" d={d} />
  </g>
);

/** A hand gripping something, seen from the knuckles; centred on (0, 0). */
export const Fist = ({ paint, transform }: { paint: GamerPaint; transform: string }) => (
  <g transform={transform}>
    <path className="cp-gamer__cuff" d="M-7 9 H7" />
    <path fill={paint.skin} d="M-7 -3 Q-7 -8 -2.5 -8 H3.5 Q8 -8 8 -3 V3 Q8 8 2.5 8 H-2 Q-7 8 -7 3 Z" />
    <path className="cp-gamer__knuckle" d="M-3.4 -7.6 V-2.4 M0.4 -8 V-2.4 M4.2 -7.6 V-2.4 M-6.4 2 Q-1.5 -0.6 4 2.6" />
  </g>
);
