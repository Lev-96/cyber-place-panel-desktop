import { IpActivityDevice } from "@/api/ipActivity";

/** The four shapes a device reads as at 16px. */
type Shape = "phone" | "tablet" | "desktop" | "laptop";

const SHAPE = {
  iphone: "phone",
  android_phone: "phone",
  ipad: "tablet",
  android_tablet: "tablet",
  windows_pc: "desktop",
  linux_pc: "desktop",
  mac: "laptop",
  chromebook: "laptop",
} as const satisfies Record<IpActivityDevice, Shape>;

/**
 * A device, in one glyph — the same hand-drawn inline-SVG idiom as
 * `SupportIcon` / `JoystickIcon`: `currentColor`, no icon package.
 * Decorative: the label next to it carries the meaning.
 */
const DeviceIcon = ({ device, size = 16 }: { device: IpActivityDevice; size?: number }) => {
  const shape = SHAPE[device];
  return (
    <svg
      className="ipa-device__icon"
      data-shape={shape}
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
      {shape === "phone" && (
        <>
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
          <path d="M11 18.5h2" />
        </>
      )}
      {shape === "tablet" && (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2.2" />
          <path d="M11 18h2" />
        </>
      )}
      {shape === "desktop" && (
        <>
          <rect x="3" y="4" width="18" height="12" rx="1.6" />
          <path d="M9 20h6M12 16v4" />
        </>
      )}
      {shape === "laptop" && (
        <>
          <rect x="5" y="5" width="14" height="10" rx="1.4" />
          <path d="M2.5 18.5h19" />
        </>
      )}
    </svg>
  );
};

export default DeviceIcon;
