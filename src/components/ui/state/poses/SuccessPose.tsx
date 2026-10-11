import { Arm, Fist, GamerFigure } from "./GamerFigure";

const STAR = "M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7 Z";

/** Done: a big grin and a thumbs-up, with a little confetti. */
const SuccessPose = () => (
  <GamerFigure
    face={{
      brows: "M104 68.6 Q109 64.6 115 67 M125 67 Q131 64.6 136 68.6",
      mouth: (
        <g>
          <path className="cp-gamer__mouth" d="M112.4 95 Q120 108 127.6 95 Q120 97 112.4 95 Z" />
          <path className="cp-gamer__teeth" d="M113.6 95.6 Q120 97.4 126.4 95.6 L125.6 97.4 Q120 99 114.4 97.4 Z" />
          <path className="cp-gamer__tongue" d="M116 102.2 Q120 99.6 124 102.2 Q120 105 116 102.2 Z" />
        </g>
      ),
      lids: "smiling",
    }}
    scene={() => (
      <g>
        <path className="cp-gamer__star cp-gamer__star--1" transform="translate(56 54)" d={STAR} />
        <path className="cp-gamer__star cp-gamer__star--2" transform="translate(190 38)" d={STAR} />
        <path className="cp-gamer__star cp-gamer__star--3" transform="translate(206 96) scale(0.7)" d={STAR} />
        <path className="cp-gamer__star cp-gamer__star--4" transform="translate(40 112) scale(0.6)" d={STAR} />
        <rect className="cp-gamer__confetti cp-gamer__confetti--1" x="74" y="30" width="5" height="2.6" rx="1" transform="rotate(30 76 31)" />
        <rect className="cp-gamer__confetti cp-gamer__confetti--2" x="160" y="22" width="5" height="2.6" rx="1" transform="rotate(-25 162 23)" />
        <circle className="cp-gamer__confetti cp-gamer__confetti--3" cx="210" cy="64" r="1.8" />
        <circle className="cp-gamer__confetti cp-gamer__confetti--1" cx="30" cy="84" r="1.6" />
      </g>
    )}
    arms={(paint) => (
      <g>
        <Arm paint={paint} d="M66 168 Q76 166 98 163" />
        <g className="cp-gamer__thumbs-up">
          <Arm paint={paint} d="M176 168 Q176 156 164 132" />
        </g>
      </g>
    )}
    front={(paint) => (
      <g>
        <Fist paint={paint} transform="translate(102 162) rotate(80)" />
        <g className="cp-gamer__thumbs-up">
          <g transform="translate(163 118) rotate(-8)">
            <path className="cp-gamer__cuff" d="M-7 13.6 H8" />
            <path fill={paint.skin} d="M-3 -5 V-15.6 Q-3 -19.4 0.6 -19.4 Q4.2 -19.4 4.2 -15.6 V-5 Z" />
            <path fill={paint.skin} d="M-8 -6 H6 Q9.4 -6 9.4 -2.6 V8.6 Q9.4 12.4 5.6 12.4 H-4 Q-8 12.4 -8 8.4 Z" />
            <path className="cp-gamer__knuckle" d="M-8 -1 H5 M-8 3.4 H5 M-8 7.8 H5" />
          </g>
        </g>
      </g>
    )}
  />
);

export default SuccessPose;
