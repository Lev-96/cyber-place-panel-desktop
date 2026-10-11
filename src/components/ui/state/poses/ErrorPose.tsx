import { Arm, Fist, GamerFigure } from "./GamerFigure";

/** Something failed: the player, worried, holding a plug that came out of its socket. */
const ErrorPose = () => (
  <GamerFigure
    face={{
      brows: "M104 71.6 Q110 69.6 115 66.6 M125 66.6 Q130 69.6 136 71.6",
      mouth: <path className="cp-gamer__mouth" d="M114.4 100 Q120 95 125.6 100 Q120 98.6 114.4 100 Z" />,
      look: 1.8,
    }}
    scene={(paint) => (
      <g>
        <rect fill={paint.gear} x="194" y="112" width="22" height="30" rx="5" />
        <path className="cp-gamer__slot" d="M201.5 122 V129 M208.5 122 V129" />
        <g className="cp-gamer__spark">
          <path d="M180 116 L185 124 L180.5 126 L186 134" />
          <path d="M188 112 L190 115 M176 126 L173 127 M190 137 L192 140" />
        </g>
      </g>
    )}
    arms={(paint) => (
      <g>
        <path className="cp-gamer__cable" d="M160 136 C146 150 138 162 120 168" />
        <Arm paint={paint} d="M174 168 Q170 162 160 146" />
      </g>
    )}
    front={(paint) => (
      <g>
        <rect fill={paint.gear} x="160" y="128" width="13" height="12" rx="3" />
        <path className="cp-gamer__prong" d="M173 131.4 H178 M173 136.6 H178" />
        <Fist paint={paint} transform="translate(159 141) rotate(-60)" />
      </g>
    )}
  />
);

export default ErrorPose;
