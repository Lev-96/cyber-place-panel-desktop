import { GamerFigure, Hand, SMILE } from "./GamerFigure";

/** Nothing here yet: the player, relaxed, idly holding a controller. */
const EmptyPose = () => (
  <GamerFigure
    mouth={SMILE}
    front={(stroke) => (
      <g className="cp-gamer__tilt">
        <path
          className="cp-gamer__device"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
          d="M98 134 H142 Q153 134 155 145 L158 157 Q160 165 152 165 Q147 165 143 159 L139 154 H101 L97 159 Q93 165 88 165 Q80 165 82 157 L85 145 Q87 134 98 134 Z"
        />
        <path className="cp-gamer__glyph" d="M104 143 V151 M100 147 H108" />
        <circle className="cp-gamer__btn-a" cx="133" cy="144" r="2.4" />
        <circle className="cp-gamer__btn-b" cx="139" cy="149" r="2.4" />
        <Hand cx={86} cy={156} stroke={stroke} />
        <Hand cx={154} cy={156} stroke={stroke} />
      </g>
    )}
  />
);

export default EmptyPose;
