import { useCallback, useEffect, useRef, useState } from "react";

export default function useSOS({
  enabled = true,
  pollUrl = "/api/sos?status=OPEN",
  pollMs = 10000,
} = {}) {
  const [banner, setBanner] = useState(null); // { id, text }
  const [openCount, setOpenCount] = useState(0);
  const [latest, setLatest] = useState(null);

  const lastSeenIdsRef = useRef(new Set());
  const pollTimer = useRef(null);

  const playChime = () => {
    try {
      new Audio("/sounds/alert.mp3").play();
    } catch (_err) {
      console.warn("[SOS] Failed to play chime:", _err);
    }
  };

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
    } catch (_err) {
      console.error("[SOS] Failed to restore banner:", _err);
    }
  }, []);

  // showBannerFor wrapped in useCallback
  const showBannerFor = useCallback((alert, isTest = false) => {
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

    try {
      sessionStorage.setItem(
        "sosBanner",
        JSON.stringify({
          id: alert.id,
          text,
          payload: alert,
          until: Date.now() + 6000,
        })
      );
    } catch (_err) {
      console.warn("[SOS] Failed to persist banner:", _err);
    }

    setTimeout(() => setBanner(null), 6000);
  }, []);

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

  // POLLING ONLY (no EventSource)
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

        // First run: just mark everything as seen, no banner spam
        if (lastSeenIdsRef.current.size === 0) {
          arr.forEach((a) => a?.id && lastSeenIdsRef.current.add(a.id));
        } else {
          // Subsequent runs: find new alerts (new IDs not seen before)
          arr.forEach((a) => {
            if (a?.id && !lastSeenIdsRef.current.has(a.id)) {
              lastSeenIdsRef.current.add(a.id);
              showBannerFor(a);
            }
          });
        }

        // Open count = current number of items
        setOpenCount(arr.length);

        console.log(`[SOS] Poll success: ${arr.length} open alerts`);
      } catch (_err) {
        console.error("[SOS] Poll error:", _err);
      }
    };

    // Initial fetch
    refreshOpen();

    // Start polling
    pollTimer.current = setInterval(refreshOpen, pollMs);

    return () => {
      cancelled = true;
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
      }
    };
  }, [enabled, pollUrl, pollMs, showBannerFor]);
  return { banner, setBanner, openCount, latest, triggerTest };
}
