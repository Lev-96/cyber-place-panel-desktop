import { realtimeVersion } from "@/realtime/echo";
import { useEffect, useState } from "react";

/**
 * A counter that changes whenever the Echo client is rebuilt — because the
 * backend told us to connect somewhere else (`primeRealtimeConfig`), or because
 * a dead client was discarded.
 *
 * Every effect that subscribes to a channel takes this as a dependency. Without
 * it a subscription stays attached to the DISCARDED client: the screen looks
 * subscribed, the socket it holds is gone, and nothing ever arrives — the exact
 * silent failure this layer exists to prevent, coming back through the side
 * door.
 */
export const useRealtimeVersion = (): number => {
  const [version, setVersion] = useState(realtimeVersion.current);

  useEffect(() => realtimeVersion.subscribe(setVersion), []);

  return version;
};
