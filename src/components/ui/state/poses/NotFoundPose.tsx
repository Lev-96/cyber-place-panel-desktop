import { Arm, Fist, GamerFigure } from "./GamerFigure";

/** The page is not there: head tilted, scratching it over a map with no road. */
const NotFoundPose = () => (
  <GamerFigure
    headTilt={-6}
    face={{
      brows: "M104 69.6 Q109 64.6 115 67.6 M125 71.2 Q131 70.2 136.4 72.4",
      mouth: <path className="cp-gamer__lip" d="M114 98.4 Q117 96 120 98.2 Q123 100.4 126.4 97.6" />,
      look: -1,
    }}
    scene={() => (
      <g className="cp-gamer__float">
        <path className="cp-gamer__mark" d="M168 34 Q168 22 179 22 Q190 22 190 31 Q190 38 181 41.5 V47" />
        <circle className="cp-gamer__mark-dot" cx="181" cy="55" r="2.6" />
      </g>
    )}
    arms={(paint) => (
      <g>
        <g className="cp-gamer__scratch">
          <Arm paint={paint} d="M70 168 C60 150 56 128 66 112 C72 100 80 84 86 70" />
        </g>
        <Arm paint={paint} d="M170 168 Q166 168 156 158" />
      </g>
    )}
    front={(paint) => (
      <g>
        <g className="cp-gamer__scratch">
          <Fist paint={paint} transform="translate(88 64) rotate(-150)" />
        </g>
        <g transform="rotate(-6 136 148)">
          <path className="cp-gamer__map" d="M112 136 L128 132 L144 136 L160 132 V156 L144 160 L128 156 L112 160 Z" />
          <path className="cp-gamer__map-fold" d="M128 132 V156 L144 160 V136 Z" />
          <path className="cp-gamer__route" d="M116 152 Q122 140 131 146 Q138 151 146 142" />
          <path className="cp-gamer__cross" d="M148 139 L154 145 M154 139 L148 145" />
        </g>
        <Fist paint={paint} transform="translate(158 154) rotate(-20) scale(-1 1)" />
      </g>
    )}
  />
);

export default NotFoundPose;
