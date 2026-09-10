import type { Ps5State } from "@/ps5/usePs5Discovery";

/**
 * How a console state looks, in the one place both screens read it from.
 *
 * The finder dialog and the sessions board show the same four states, and a
 * console that is green on one screen and grey on the other would be a bug an
 * operator could not resolve — so the colour and the wording live here rather
 * than in each component.
 */
export const PS5_STATE_LOOK: Record<Ps5State, { dot: string; key: string }> = {
  awake: { dot: "#3ddc97", key: "ps5.state.awake" },
  rest: { dot: "#8794ae", key: "ps5.state.rest" },
  unreachable: { dot: "#ef4444", key: "ps5.state.unreachable" },
  unknown: { dot: "#f2b544", key: "ps5.state.unknown" },
};
