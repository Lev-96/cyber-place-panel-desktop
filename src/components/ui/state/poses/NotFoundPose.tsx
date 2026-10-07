import { GamerFigure, Hand, SMALL_O } from "./GamerFigure";

/** The page is not there: the player, head tilted, over a map with no road. */
const NotFoundPose = () => (
  <GamerFigure
    mouth={SMALL_O}
    headTilt={-7}
    scene={() => (
      <g className="cp-gamer__float">
        <path className="cp-gamer__mark" d="M170 34 Q170 24 179 24 Q188 24 188 32 Q188 38 180 41 V46" />
        <circle className="cp-gamer__mark-dot" cx="180" cy="53" r="2.2" />
      </g>
    )}
    front={(stroke) => (
      <g className="cp-gamer__tilt">
        <path
          className="cp-gamer__device"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinejoin="round"
          d="M82 134 L101 128 L120 134 L139 128 L158 134 V162 L139 156 L120 162 L101 156 L82 162 Z"
        />
        <path className="cp-gamer__route" d="M90 154 Q100 140 112 148 Q124 156 132 142" />
        <path className="cp-gamer__cross" d="M138 137 L146 145 M146 137 L138 145" />
        <Hand cx={82} cy={150} stroke={stroke} />
        <Hand cx={158} cy={150} stroke={stroke} />
      </g>
    )}
  />
);

export default NotFoundPose;
