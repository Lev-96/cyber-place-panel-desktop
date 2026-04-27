import { BranchSnapshot, RealtimeService } from "@/services/realtime/RealtimeService";
import { useEffect, useMemo, useRef, useState } from "react";

interface State { snapshot: BranchSnapshot | null; error: Error | null; loading: boolean; }

export const useRealtimeBranch = (branchId: number | null) => {
  const [state, setState] = useState<State>({ snapshot: null, error: null, loading: !!branchId });
  const svcRef = useRef<RealtimeService | null>(null);

  useEffect(() => {
    if (!branchId) return;
    const svc = new RealtimeService(branchId);
    svcRef.current = svc;
    setState({ snapshot: null, error: null, loading: true });

    const offSnap = svc.on("snapshot", (snapshot) =>
      setState({ snapshot, error: null, loading: false }),
    );
    const offErr = svc.on("error", (error) =>
      setState((s) => ({ snapshot: s.snapshot, error, loading: false })),
    );
    svc.start();

    return () => {
      offSnap(); offErr(); svc.stop(); svcRef.current = null;
    };
  }, [branchId]);

  const refresh = useMemo(() => () => svcRef.current?.refresh(), []);
  return { ...state, refresh };
};
