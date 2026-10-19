import { Arm, Fist, GamerFigure } from "./GamerFigure";

const Z = "M0 0 H7 L0 8 H7";

/** No connection: nothing to play, so the player is nodding off. */
const OfflinePose = () => (
  <GamerFigure
    headMotion="cp-gamer__nod"
    face={{
      brows: "M104 72.6 Q109 71 115 72 M125 72 Q131 71 136 72.6",
      mouth: <ellipse className="cp-gamer__mouth" cx="121" cy="99" rx="1.9" ry="1.6" />,
      lids: "sleepy",
    }}
    scene={() => (
      <g>
        <g className="cp-gamer__wifi">
          <path className="cp-gamer__wave" d="M38 58 Q56 42 74 58 M44 65 Q56 55 68 65 M50 72 Q56 67 62 72" />
          <circle className="cp-gamer__mark-dot" cx="56" cy="78" r="2.6" />
          <path className="cp-gamer__cross" d="M40 46 L72 82" />
        </g>
        {/* The letters drift (CSS) inside groups that place them (attribute). */}
        <g transform="translate(156 50)"><path className="cp-gamer__z" d={Z} /></g>
        <g transform="translate(166 36) scale(1.3)"><path className="cp-gamer__z cp-gamer__z--2" d={Z} /></g>
        <g transform="translate(178 20) scale(1.6)"><path className="cp-gamer__z cp-gamer__z--3" d={Z} /></g>
      </g>
    )}
    arms={(paint) => (
      <g>
        <Arm paint={paint} d="M66 168 Q76 164 104 161" />
        <Arm paint={paint} d="M174 168 Q164 164 136 161" />
      </g>
    )}
    front={(paint) => (
      <g>
        <Fist paint={paint} transform="translate(108 160) rotate(80)" />
        <Fist paint={paint} transform="translate(132 160) rotate(-80) scale(-1 1)" />
      </g>
    )}
  />
);

export default OfflinePose;
