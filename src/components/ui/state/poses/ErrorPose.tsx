import { FLAT, GamerFigure, Hand } from "./GamerFigure";

/** Something failed: the player holding an unplugged cable next to its socket. */
const ErrorPose = () => (
  <GamerFigure
    mouth={FLAT}
    scene={(stroke) => (
      <g>
        <rect className="cp-gamer__device" stroke={stroke} strokeWidth="2" x="196" y="120" width="22" height="30" rx="5" />
        <path className="cp-gamer__glyph" d="M203 131 V137 M211 131 V137" />
        <path className="cp-gamer__spark" d="M182 128 L188 134 L183 137 L190 144" />
      </g>
    )}
    front={(stroke) => (
      <g className="cp-gamer__tilt">
        <path fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" d="M34 170 Q40 140 74 150 Q110 160 150 148" />
        <rect className="cp-gamer__plug" x="150" y="141" width="18" height="14" rx="3" />
        <path className="cp-gamer__glyph" d="M168 145 H175 M168 151 H175" />
        <Hand cx={150} cy={150} stroke={stroke} />
      </g>
    )}
  />
);

export default ErrorPose;
