import { GamerFigure, SMILE } from "./GamerFigure";

const STAR = "M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7 Z";

/** Done: the player with a thumbs-up. */
const SuccessPose = () => (
  <GamerFigure
    mouth={SMILE}
    motion="cp-gamer__bounce"
    scene={() => (
      <g>
        <path className="cp-gamer__star cp-gamer__star--1" transform="translate(58 58)" d={STAR} />
        <path className="cp-gamer__star cp-gamer__star--2" transform="translate(196 44)" d={STAR} />
        <path className="cp-gamer__star cp-gamer__star--3" transform="translate(206 98) scale(0.7)" d={STAR} />
      </g>
    )}
    front={(stroke) => (
      <g>
        <path fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round" d="M156 140 Q170 132 170 116" />
        <rect className="cp-gamer__skin" stroke={stroke} strokeWidth="2" x="160" y="100" width="20" height="18" rx="6" />
        <path className="cp-gamer__skin" stroke={stroke} strokeWidth="2" strokeLinejoin="round" d="M164 101 V88 Q164 83 169 83 Q173 83 173 88 V101 Z" />
        <path className="cp-gamer__glyph" d="M165 106 H175 M165 112 H175" />
      </g>
    )}
  />
);

export default SuccessPose;
