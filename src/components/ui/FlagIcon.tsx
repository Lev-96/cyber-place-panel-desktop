import { ReactElement } from "react";
import { Lang } from "@/i18n/translations";

/**
 * National flags for the language picker, drawn as inline SVG.
 *
 * NOT emoji. Windows ships no font with regional-indicator glyphs, so 🇺🇸 / 🇷🇺
 * render there as the bare letter pairs "US" / "RU" — and Windows is this
 * panel's primary target. Inline SVG renders identically on Windows, Linux and
 * macOS, scales to any size, needs no network request and no font file, and
 * costs a few hundred bytes.
 *
 * Adding a language means adding one entry to {@link FLAGS}; an unknown code
 * degrades to a neutral placeholder rather than throwing, so a new locale can
 * ship in the backend registry before its artwork lands.
 */

const RADIUS = 5;

/** United States — canton + 13 stripes, simplified to read at 44px. */
const UnitedStates = () => (
  <>
    <rect width="60" height="40" rx={RADIUS} fill="#fff" />
    {[0, 2, 4, 6, 8, 10, 12].map((i) => (
      <rect key={i} y={(i * 40) / 13} width="60" height={40 / 13} fill="#b22234" />
    ))}
    <rect width="26" height={(40 / 13) * 7} rx={RADIUS} fill="#3c3b6e" />
    {/* Star field: a 5×4 grid reads as "stars" at icon size without the noise
        of all fifty. */}
    {[0, 1, 2, 3].map((row) =>
      [0, 1, 2, 3, 4].map((col) => (
        <circle
          key={`${row}-${col}`}
          cx={3.5 + col * 5}
          cy={3 + row * 4.6}
          r="1.25"
          fill="#fff"
        />
      )),
    )}
  </>
);

/** Russia — white / blue / red. */
const Russia = () => (
  <>
    <rect width="60" height="40" rx={RADIUS} fill="#fff" />
    <rect y="13.33" width="60" height="13.34" fill="#0039a6" />
    <rect y="26.67" width="60" height="13.33" fill="#d52b1e" />
  </>
);

/** Armenia — red / blue / apricot. */
const Armenia = () => (
  <>
    <rect width="60" height="40" rx={RADIUS} fill="#d90012" />
    <rect y="13.33" width="60" height="13.34" fill="#0033a0" />
    <rect y="26.67" width="60" height="13.33" fill="#f2a800" />
  </>
);

const Unknown = () => (
  <rect width="60" height="40" rx={RADIUS} fill="#1f2a44" stroke="#334155" />
);

const FLAGS: Record<Lang, () => ReactElement> = {
  en: UnitedStates,
  ru: Russia,
  am: Armenia,
};

interface Props {
  lang: Lang;
  /** Rendered width in px; height follows the 3:2 ratio. */
  size?: number;
  className?: string;
}

const FlagIcon = ({ lang, size = 44, className }: Props) => {
  const Shape = FLAGS[lang] ?? Unknown;

  return (
    <svg
      className={className}
      width={size}
      height={(size * 2) / 3}
      viewBox="0 0 60 40"
      // Decorative: the language name next to it is the accessible label, and
      // announcing "flag of the United States" before "English" would be noise
      // for a screen-reader user picking a language.
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", borderRadius: 6, boxShadow: "0 1px 4px rgba(0,0,0,.45)" }}
    >
      <Shape />
    </svg>
  );
};

export default FlagIcon;
