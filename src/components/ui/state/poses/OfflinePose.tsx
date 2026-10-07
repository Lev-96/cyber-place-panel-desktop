import { FLAT, GamerFigure, Hand } from "./GamerFigure";

/** No connection: the player under a Wi-Fi sign that is crossed out. */
const OfflinePose = () => (
  <GamerFigure
    mouth={FLAT}
    lookX={2}
    scene={() => (
      <g>
        <path className="cp-gamer__wave cp-gamer__wave--3" d="M156 52 Q180 30 204 52" />
        <path className="cp-gamer__wave cp-gamer__wave--2" d="M164 60 Q180 46 196 60" />
        <path className="cp-gamer__wave cp-gamer__wave--1" d="M172 68 Q180 62 188 68" />
        <circle className="cp-gamer__mark-dot" cx="180" cy="76" r="3" />
        <path className="cp-gamer__cross" d="M160 34 L200 80" />
      </g>
    )}
    front={(stroke) => (
      <g>
        <Hand cx={100} cy={150} stroke={stroke} />
        <Hand cx={140} cy={150} stroke={stroke} />
      </g>
    )}
  />
);

export default OfflinePose;
