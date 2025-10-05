// src/sos/SOSContext.jsx
import { createContext, useContext, useEffect } from "react";
import useSOS from "../hooks/useSOS";

const SOSContext = createContext(null);

export function SOSProvider({
  children,
  enabled = true,
  sseUrl = "/api/realtime/sos",
  pollUrl = "/api/sos?status=OPEN",
}) {
  const sos = useSOS({ enabled, sseUrl, pollUrl });

  // expose for debugging
  useEffect(() => {
    // attach once
    if (!window.__sosStore) window.__sosStore = {};
    Object.assign(window.__sosStore, sos);
    return () => {
      // keep it around; helps across route changes
      Object.assign(window.__sosStore, {});
    };
  }, [sos]);

  return <SOSContext.Provider value={sos}>{children}</SOSContext.Provider>;
}

export function useSOSStore() {
  const ctx = useContext(SOSContext);
  if (!ctx) throw new Error("useSOSStore must be used inside <SOSProvider>");
  return ctx;
}
