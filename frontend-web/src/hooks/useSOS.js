// src/hooks/useSOS.js
import { useEffect, useRef, useState } from "react";

export default function useSOS({
  enabled = true,
  sseUrl = "/api/realtime/sos",
  pollUrl = "/api/sos?status=OPEN",
  pollMs = 10000,
} = {}) {
  const [banner, setBanner] = useState(null); // { id, text }
  const [openCount, setOpenCount] = useState(0);
  const [latest, setLatest] = useState(null);

  const lastSeenIdsRef = useRef(new Set());
  const pollTimer = useRef(null);
  const esRef = useRef(null);

  const playChime = () => {
    try { 
      new Audio("/sounds/alert.mp3").play(); 
    } catch (err) {
      console.warn("[SOS] Failed to play chime:", err);
    }
  };

  // Helper to get JWT token
  const getToken = () => {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("station_token") ||
      localStorage.getItem("authToken")
    );
  };

  // restore banner after reload within 6s TTL
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sosBanner");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && saved.until && Date.now() < saved.until) {
        setBanner({ id: saved.id, text: saved.text });
        setLatest(saved.payload || null);
        setOpenCount((v) => (v > 0 ? v : 1));
        setTimeout(() => setBanner(null), saved.until - Date.now());
        console.log("[SOS] restored banner from sessionStorage");
      } else {
        sessionStorage.removeItem("sosBanner");
      }
    } catch (err) {
      console.error("[SOS] Failed to restore banner:", err);
    }
  }, []);

  const showBannerFor = (alert, isTest = false) => {
    if (!alert?.id) return;

    if (!lastSeenIdsRef.current.has(alert.id)) {
      lastSeenIdsRef.current.add(alert.id);
    }

    setLatest(alert);
    setOpenCount((v) => v + 1);

    const text = isTest ? "Received SOS Alert! (Test)" : "Received SOS Alert!";
    setBanner({ id: alert.id, text });
    playChime();
    console.log("[SOS] banner set:", { alert, text });

    // persist ~6s
    try {
      sessionStorage.setItem(
        "sosBanner",
        JSON.stringify({ id: alert.id, text, payload: alert, until: Date.now() + 6000 })
      );
    } catch (err) {
      console.warn("[SOS] Failed to persist banner:", err);
    }

    setTimeout(() => setBanner(null), 6000);
  };

  // public: fire a fake alert (frontend only)
  const triggerTest = (partial = {}) => {
    if (!enabled) return;
    const fake = {
      id: `test-${Date.now()}`,
      userId: "u-demo",
      userName: "Demo Rider",
      location: { lat: 14.5995, lng: 120.9842 },
      note: "Practice alert",
      ...partial,
    };
    showBannerFor(fake, true);
  };

  // SSE + polling
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const refreshOpen = async () => {
      try {
        const token = getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const r = await fetch(pollUrl, { credentials: "include", headers });
        if (!r.ok) {
          console.error(`[SOS] Poll failed: ${r.status} ${r.statusText}`);
          return;
        }

        const data = await r.json();
        if (cancelled) return;

        const arr = data.items ? data.items : Array.isArray(data) ? data : [];
        setOpenCount(arr.length);

        if (lastSeenIdsRef.current.size === 0) {
          arr.forEach((a) => a?.id && lastSeenIdsRef.current.add(a.id));
        }

        console.log(`[SOS] Poll success: ${arr.length} open alerts`);
      } catch (err) {
        console.error("[SOS] Poll error:", err);
      }
    };

    refreshOpen();

    try {
      const es = new EventSource(sseUrl, { withCredentials: true });
      esRef.current = es;

      es.addEventListener("error", (err) => {
        console.log("[SOS] SSE error, falling back to polling");
        es.close();
        pollTimer.current = setInterval(refreshOpen, pollMs);
      });

      es.addEventListener("sos.created", (ev) => {
        try {
          const alert = JSON.parse(ev.data);
          if (!lastSeenIdsRef.current.has(alert.id)) showBannerFor(alert);
        } catch (err) {
          console.warn("[SOS] Failed to parse SSE sos.created:", err);
        }
      });

      es.addEventListener("sos.resolved", (ev) => {
        try {
          const alert = JSON.parse(ev.data);
          if (alert?.id && lastSeenIdsRef.current.has(alert.id)) {
            setOpenCount((v) => Math.max(0, v - 1));
          }
        } catch (err) {
          console.warn("[SOS] Failed to parse SSE sos.resolved:", err);
        }
      });
    } catch (err) {
      console.log("[SOS] SSE not available, using polling only", err);
      pollTimer.current = setInterval(refreshOpen, pollMs);
    }

    return () => {
      cancelled = true;
      if (esRef.current) esRef.current.close();
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [enabled, sseUrl, pollUrl, pollMs]);

  return { banner, setBanner, openCount, latest, triggerTest };
}
