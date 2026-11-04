import LineIcon from "@/components/ui/LineIcon";
import type { ReactNode } from "react";

/**
 * The session-card actions as pictures (2026-11-03). A list row too narrow
 * for its buttons' words keeps the same buttons in the same places and shows
 * these instead; the full name stays the button's tooltip and accessible name
 * (`SessionCardAction`'s `fullLabel`). Hidden at every other size, so a card
 * or a row with room looks exactly as before.
 *
 * Keyed by the button's `data-action`. Geometry from Lucide
 * (https://lucide.dev), ISC License, Copyright (c) Lucide Contributors.
 */
export type ActionIconId =
  | "add-item" | "extra" | "add-time" | "pause" | "resume" | "relocate" | "stop" | "more";

const play = <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />;

const SHAPES: Record<ActionIconId, ReactNode> = {
  // shopping-bag
  "add-item": (
    <>
      <path d="M16 10a4 4 0 0 1-8 0" />
      <path d="M3.103 6.034h17.794" />
      <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
    </>
  ),
  // package
  extra: (
    <>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" />
      <path d="m7.5 4.27 9 5.15" />
    </>
  ),
  // clock-plus
  "add-time": (
    <>
      <path d="M12 6v6l3.644 1.822" />
      <path d="M16 19h6" />
      <path d="M19 16v6" />
      <path d="M21.92 13.267a10 10 0 1 0-8.653 8.653" />
    </>
  ),
  pause: (
    <>
      <rect x="14" y="3" width="5" height="18" rx="1" />
      <rect x="5" y="3" width="5" height="18" rx="1" />
    </>
  ),
  resume: play,
  // arrow-right-left
  relocate: (
    <>
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </>
  ),
  // square
  stop: <rect x="5" y="5" width="14" height="14" rx="2" />,
  // ellipsis
  more: (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>
  ),
};

const ActionIcon = ({ id, size = 18 }: { id: ActionIconId; size?: number }) => (
  <LineIcon className="session-card__btn-icon" data-action-icon={id} size={size}>
    {SHAPES[id]}
  </LineIcon>
);

export default ActionIcon;
