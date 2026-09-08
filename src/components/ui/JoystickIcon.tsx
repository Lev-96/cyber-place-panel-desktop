/**
 * A gamepad, in one glyph.
 *
 * Inline SVG because that is how every icon in this app is drawn (`SupportIcon`,
 * `FlagIcon`, `Checkbox`, `BackButton`): there is no icon package in the
 * dependency list, and adding one to draw a single 14px shape would ship a
 * library to save a dozen lines.
 *
 * `currentColor` throughout, so it takes the colour of the line it sits on and
 * follows a disabled or hovered state for free. An icon with a hard-coded
 * colour is one that stops matching the moment the theme moves.
 *
 * It replaces the 🎮 the tile used to print. An emoji is drawn by whatever font
 * the OS picked — full-colour on one machine, a flat outline on another, and a
 * different width on each — which is exactly what a row of numbers that has to
 * line up across twenty tiles cannot have.
 */
const JoystickIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ flexShrink: 0, display: "block" }}
  >
    {/* The body: two grips under one bridge, the silhouette that reads as a
        gamepad at 14px when nothing else does. */}
    <path d="M7.5 8.5h9a4.5 4.5 0 0 1 4.4 3.6l.8 4a3 3 0 0 1-5.3 2.5L14.6 16H9.4l-1.8 2.6a3 3 0 0 1-5.3-2.5l.8-4A4.5 4.5 0 0 1 7.5 8.5Z" />
    {/* The d-pad. */}
    <path d="M6.8 12.2v2.2M5.7 13.3h2.2" />
    {/* And the two buttons opposite it. */}
    <path d="M16.4 12.6h.01M18.4 14.4h.01" />
  </svg>
);

export default JoystickIcon;
