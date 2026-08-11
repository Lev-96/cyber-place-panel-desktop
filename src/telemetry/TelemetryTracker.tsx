import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { startTelemetry, track } from "@/telemetry/reporter";

/**
 * Mounts the reporter and records one `screen.view` per navigation.
 *
 * Rendered inside the router so `useLocation` can see route changes, and it
 * renders nothing — instrumentation must be invisible to the tree it observes.
 *
 * Only the PATH is reported, never the search or hash: those carry ids and
 * filters, which would turn an analytics label into a low-grade data leak and
 * shatter the "top screens" ranking into thousands of unique rows.
 */
const TelemetryTracker = () => {
  const { pathname } = useLocation();

  useEffect(() => { startTelemetry(); }, []);

  useEffect(() => {
    track("screen.view", { name: pathname });
  }, [pathname]);

  return null;
};

export default TelemetryTracker;
