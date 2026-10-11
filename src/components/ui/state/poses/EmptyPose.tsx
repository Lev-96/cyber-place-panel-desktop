import { Arm, Fist, GamerFigure } from "./GamerFigure";

/** Nothing here yet: the player, relaxed, idly thumbing a controller. */
const EmptyPose = () => (
  <GamerFigure
    face={{
      brows: "M104 71 Q109 68 115 69.6 M125 69.6 Q131 68 136 71",
      mouth: <path className="cp-gamer__mouth" d="M113.6 96.6 Q120 104 126.4 96.6 Q120 98.6 113.6 96.6 Z" />,
    }}
    arms={(paint) => (
      <g>
        <Arm paint={paint} d="M74 168 Q78 172 92 162" />
        <Arm paint={paint} d="M166 168 Q162 172 148 162" />
      </g>
    )}
    front={(paint) => (
      <g>
        <path
          fill={paint.gear}
          d="M100 138 C104 135 110 136 113 138 H127 C130 136 136 135 140 138 C146 142 151 152 151 160 C151 166 145 168 141 163 L136 157 H104 L99 163 C95 168 89 166 89 160 C89 152 94 142 100 138 Z"
        />
        <path className="cp-gamer__edge-hi" d="M101 139 C105 136.6 110 137.4 113 139 H127 C130 137.4 135 136.6 139 139" />
        <path className="cp-gamer__glow-line" d="M115 139.4 H125" />
        <path className="cp-gamer__dpad" d="M101 143 V149 M98 146 H104" />
        <circle className="cp-gamer__btn cp-gamer__btn--a" cx="139" cy="142.8" r="1.7" />
        <circle className="cp-gamer__btn cp-gamer__btn--b" cx="142.4" cy="146" r="1.7" />
        <circle className="cp-gamer__btn cp-gamer__btn--c" cx="139" cy="149.2" r="1.7" />
        <circle className="cp-gamer__btn cp-gamer__btn--d" cx="135.6" cy="146" r="1.7" />
        <circle className="cp-gamer__stick" cx="112" cy="151" r="3.4" />
        <circle className="cp-gamer__stick" cx="128" cy="151" r="3.4" />
        <Fist paint={paint} transform="translate(94 160) rotate(28)" />
        <Fist paint={paint} transform="translate(146 160) rotate(-28) scale(-1 1)" />
        <ellipse fill={paint.skin} className="cp-gamer__thumb" cx="111" cy="149.6" rx="3.4" ry="2.6" />
        <ellipse fill={paint.skin} className="cp-gamer__thumb cp-gamer__thumb--r" cx="129" cy="149.6" rx="3.4" ry="2.6" />
      </g>
    )}
  />
);

export default EmptyPose;
