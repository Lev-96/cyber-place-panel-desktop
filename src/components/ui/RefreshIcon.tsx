/**
 * Two arrows chasing each other round a circle: "read it again".
 *
 * Same hand-drawn inline-SVG idiom as `JoystickIcon` / `DeviceIcon`:
 * `currentColor`, no icon package, decorative (the button's label carries the
 * meaning). The caller spins it with a class while a re-read is in flight; the
 * geometry is centred on 12,12 so a rotation does not wobble.
 */
const RefreshIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg
    className={className}
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
  >
    <path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3" />
    <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3" />
    <path d="M17.6 3.2v3.6H14" />
    <path d="M6.4 20.8v-3.6H10" />
  </svg>
);

export default RefreshIcon;
