import { useEffect, useState } from "react";

const read = (): boolean => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

/**
 * Whether the machine says it has a network, live (`online` / `offline`
 * events). Presentation only: it picks the offline state's wording and the
 * offline notice. It never triggers a request — screens re-read through their
 * own polling / realtime resync, which already exists.
 *
 * `navigator.onLine === true` does not promise the backend is reachable; a
 * request failing with no answer is classified offline on its own
 * (`classifyError`).
 */
export const useOnline = (): boolean => {
  const [online, setOnline] = useState(read);
  useEffect(() => {
    const update = () => setOnline(read());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
};
