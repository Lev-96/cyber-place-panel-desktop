/**
 * The board's tile order against the server's device list: keep the local
 * order for devices still present, append new ones in server order, drop
 * removed ones. Pure, so the board can use it DURING render — the order held
 * in state is synced after paint, and reading it alone painted one frame of
 * "No devices registered" on every first load (2026-10-07).
 */
export const reconcileOrder = (local: readonly number[], serverIds: readonly number[]): number[] => {
  const present = new Set(serverIds);
  const kept = local.filter((id) => present.has(id));
  const keptSet = new Set(kept);
  const added = serverIds.filter((id) => !keptSet.has(id));
  return [...kept, ...added];
};
