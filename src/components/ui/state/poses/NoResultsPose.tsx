import { GamerFigure, Hand, SMALL_O } from "./GamerFigure";

/** Nothing matched: the player searching with a magnifier, eyes on the lens. */
const NoResultsPose = () => (
  <GamerFigure
    mouth={SMALL_O}
    lookX={3}
    front={(stroke) => (
      <g className="cp-gamer__scan">
        <path fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" d="M156 150 L168 128" />
        <circle className="cp-gamer__lens" stroke={stroke} strokeWidth="3" cx="176" cy="114" r="15" />
        <path className="cp-gamer__glint" d="M168 108 Q171 103 177 102" />
        <Hand cx={155} cy={152} stroke={stroke} />
      </g>
    )}
  />
);

export default NoResultsPose;
