// src/hooks/useSOS.js
import { useEffect, useRef, useState } from "react";

export default function useSOS({ sseUrl = "/api/realtime/sos", pollUrl = "/api/sos?status=OPEN", pollMs = 10000 } = {}) {
  const [banner, setBanner] = useState(null);    // { id, text }
  const [openCount, setOpenCount] = useState(0); // for a badge in your sidebar/header
  const lastSeenIdsRef = useRef(new Set());      // basic de-dupe across reconnects
  const pollTimer = useRef(null);
  const esRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // initial load (also used by polling fallback)
    const refreshOpen = async () => {
      try {
        const r = await fetch(pollUrl);
        const data = await r.json(); // expect array of alerts
        if (cancelled) return;
        setOpenCount(data.length);
        // seed lastSeenIds so we don't banner for all historic items
        if (lastSeenIdsRef.current.size === 0) {
          data.forEach(a => lastSeenIdsRef.current.add(a.id));
        }
      } catch (e) {
        console.error("SOS refresh failed", e);
      }
    };

    refreshOpen();

    // Try SSE first
    try {
      const es = new EventSource(sseUrl, { withCredentials: true });
      esRef.current = es;

      es.addEventListener("open", () => console.debug("[SOS] SSE connected"));
      es.addEventListener("error", (e) => {
        console.warn("[SOS] SSE error, switching to polling fallback", e);
        es.close();
        // start polling fallback
        pollTimer.current = setInterval(refreshOpen, pollMs);
      });

      // server should send events named "sos.created" with the alert payload
      es.addEventListener("sos.created", (ev) => {
        try {
          const alert = JSON.parse(ev.data);
          if (!lastSeenIdsRef.current.has(alert.id)) {
            lastSeenIdsRef.current.add(alert.id);
            setOpenCount(v => v + 1);
            setBanner({ id: alert.id, text: "Received SOS Alert!" });
            // optional sound
            try { new Audio("/sounds/alert.mp3").play(); } catch (_) {}
            setTimeout(() => setBanner(null), 6000);
          }
        } catch (e) {
          console.error("SOS event parse error", e);
        }
      });

      // optional: server can also emit "sos.resolved" to decrement
      es.addEventListener("sos.resolved", (ev) => {
        try {
          const alert = JSON.parse(ev.data);
          if (lastSeenIdsRef.current.has(alert.id)) {
            setOpenCount(v => Math.max(0, v - 1));
          }
        } catch {}
      });
    } catch (e) {
      console.warn("[SOS] SSE not available; using polling");
      pollTimer.current = setInterval(refreshOpen, pollMs);
    }

    return () => {
      cancelled = true;
      if (esRef.current) esRef.current.close();
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [sseUrl, pollUrl, pollMs]);

  return { banner, setBanner, openCount };
}
