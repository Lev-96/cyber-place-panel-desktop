import type { ReactNode, SVGAttributes } from "react";

/**
 * The app's one outline-icon frame (2026-11-03): a 24×24 viewBox,
 * `currentColor` stroke 1.75, round caps and joins, hidden from assistive
 * tech (the control it sits in carries the name). Shared by the side menu
 * (`NavIcon`) and the session-card actions (`ActionIcon`), so both draw one
 * style and a theme or hover colour applies to every icon the same way.
 */
type Props = Omit<SVGAttributes<SVGSVGElement>, "children"> & { size?: number; children: ReactNode };

const LineIcon = ({ size = 18, children, ...rest }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

export default LineIcon;
