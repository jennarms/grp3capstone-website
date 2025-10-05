// src/pages/SOSTestPage.jsx
import { useEffect, useMemo, useState } from "react";
import { StationNavbar } from "../components/station_navbar";
import { LogoutButton } from "../components/logout_button";
import { useSOSStore } from "../sos/SOSContext";
import "./SOSTestPage.css";

export function SOSTestPage() {
  const { openCount, latest, triggerTest } = useSOSStore();

  const [userName, setUserName] = useState("Practice Rider");
  const [lat, setLat]   = useState("14.5995");
  const [lng, setLng]   = useState("120.9842");
  const [note, setNote] = useState("Drill / practice notification");

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const notifyBrowser = (payload) => {
    if (!("Notification" in window)) return;
    const coords = payload?.location &&
      Number.isFinite(payload.location.lat) &&
      Number.isFinite(payload.location.lng)
        ? `${payload.location.lat.toFixed(4)}, ${payload.location.lng.toFixed(4)}`
        : null;

    const body = [
      payload?.userName && `From: ${payload.userName}`,
      coords && `Location: ${coords}`,
      payload?.note,
    ].filter(Boolean).join("\n") || "A rider has triggered SOS.";

    const show = () => {
      try {
        const n = new Notification("Received SOS Alert! (Test)", {
          body,
          icon: "/icons/sos.png",
          badge: "/icons/sos-badge.png",
          vibrate: [80, 40, 80],
          tag: "sos-alert",
          renotify: true,
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch {}
    };

    if (Notification.permission === "granted") show();
    else if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => p === "granted" && show());
    }
  };

  const testPayload = useMemo(() => {
    const latNum = Number(lat), lngNum = Number(lng);
    return {
      userName: userName || "Practice Rider",
      location: Number.isFinite(latNum) && Number.isFinite(lngNum) ? { lat: latNum, lng: lngNum } : undefined,
      note: note || undefined,
    };
  }, [userName, lat, lng, note]);

  const sendTest = () => {
    triggerTest?.(testPayload);   // GLOBAL store → global banner shows on ALL pages
    notifyBrowser(testPayload);   // optional OS/browser notification
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        sendTest();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sendTest]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sosTest") === "1") sendTest();
  }, []); // eslint-disable-line

  const latestCoords =
    latest?.location &&
    Number.isFinite(Number(latest.location.lat)) &&
    Number.isFinite(Number(latest.location.lng))
      ? `${Number(latest.location.lat).toFixed(4)}, ${Number(latest.location.lng).toFixed(4)}`
      : null;

  return (
    <div className="sos-test-container">
      <StationNavbar />
      {/* No local <SOSBanner/> here—global banner is mounted in App.jsx */}

      <main className="sos-test-main">
        <header className="sos-test-header">
          <h1 className="sos-test-title">
            SOS Test Console {openCount > 0 && <span className="sos-badge">{openCount} SOS</span>}
          </h1>
          <LogoutButton />
        </header>

        <section className="sos-test-card">
          <h2>Send Practice SOS</h2>
          <div className="sos-grid">
            <label className="sos-field"><span>Rider name</span>
              <input value={userName} onChange={(e) => setUserName(e.target.value)} />
            </label>
            <label className="sos-field"><span>Latitude</span>
              <input value={lat} onChange={(e) => setLat(e.target.value)} />
            </label>
            <label className="sos-field"><span>Longitude</span>
              <input value={lng} onChange={(e) => setLng(e.target.value)} />
            </label>
            <label className="sos-field sos-field-wide"><span>Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>

          <div className="sos-actions">
            <button className="sos-btn" onClick={sendTest}>Send Test SOS</button>
            <span className="sos-hint">Shortcut: Ctrl + Alt + S</span>
          </div>
        </section>

        <section className="sos-test-card">
          <h2>Latest Alert (preview)</h2>
          {latest ? (
            <div className="sos-latest">
              <div><strong>ID:</strong> {latest.id || "(test id)"}</div>
              <div><strong>User:</strong> {latest.userName || latest.userId || "—"}</div>
              <div>
                <strong>Coords:</strong>{" "}
                {latestCoords ? (
                  <a className="sos-link" href={`https://maps.google.com/?q=${latestCoords}`} target="_blank" rel="noreferrer">
                    {latestCoords}
                  </a>
                ) : "—"}
              </div>
              {latest?.note && <div><strong>Note:</strong> {latest.note}</div>}
            </div>
          ) : (
            <div className="sos-empty">No alerts yet — click “Send Test SOS”.</div>
          )}
        </section>
      </main>
    </div>
  );
}
