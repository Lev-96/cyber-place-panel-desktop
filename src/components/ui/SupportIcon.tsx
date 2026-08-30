/**
 * A headset — support, in one glyph.
 *
 * Inline SVG because that is how every other icon in this app is drawn
 * (`FlagIcon`, `Checkbox`, `BackButton`): there is no icon package in the
 * dependency list, and adding one to draw a single 16px shape would ship a
 * library to save nine lines.
 *
 * `currentColor` throughout, so it inherits the nav link's colour and its
 * hover and active states for free — an icon with a hard-coded colour is one
 * that stops matching the moment the theme moves.
 */
const SupportIcon = ({ size = 16 }: { size?: number }) => (
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
    style={{ flexShrink: 0 }}
  >
    {/* The band over the head: support is reachable. */}
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    {/* Ear cups. */}
    <rect x="2" y="13" width="4" height="7" rx="1.6" />
    <rect x="18" y="13" width="4" height="7" rx="1.6" />
    {/* The mic arm — the half that says somebody answers. */}
    <path d="M20 20v.5a2.5 2.5 0 0 1-2.5 2.5H14" />
  </svg>
);

export default SupportIcon;
