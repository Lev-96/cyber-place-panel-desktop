import { Arm, Fist, GamerFigure } from "./GamerFigure";

/** Nothing matched: the player peering through a magnifier, one brow up. */
const NoResultsPose = () => (
  <GamerFigure
    face={{
      brows: "M104 71.4 Q109 69 115 70.4 M125 68.4 Q131 63.6 137 66.8",
      mouth: <ellipse className="cp-gamer__mouth" cx="121" cy="98.4" rx="2.3" ry="2.7" />,
      look: 1.6,
    }}
    arms={(paint) => (
      <g className="cp-gamer__sweep">
        <Arm paint={paint} d="M172 168 Q168 160 156 138" />
      </g>
    )}
    front={(paint) => (
      <g className="cp-gamer__sweep">
        <path className="cp-gamer__handle" d="M155 132 L164 112" />
        <circle className="cp-gamer__glass" cx="172" cy="98" r="14" />
        <circle className="cp-gamer__glass-hi" cx="168" cy="93" r="7" />
        <circle className="cp-gamer__rim-ring" cx="172" cy="98" r="14" />
        <circle fill="none" stroke={paint.line} strokeWidth="1" strokeOpacity="0.7" cx="172" cy="98" r="15.6" />
        <path className="cp-gamer__sheen" d="M163 94 Q165 87 172 86" />
        <Fist paint={paint} transform="translate(155 135) rotate(-24)" />
      </g>
    )}
  />
);

export default NoResultsPose;
