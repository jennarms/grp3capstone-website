import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_boarding.css";

import ManualBookingModal from "../modules/ManualBooking/ManualBookingModal.jsx";
import PassengerTable from "../modules/PassengerTable.jsx"; // Corrected import for PassengerTable
import ScanButtonModule from "../modules/ScanButtonModule.jsx"; // ScanButtonModule import

const apiUrl = import.meta.env.VITE_API_URL;

export function Boarding() {
  // State for station and schedule time, to be updated after fetching the data
  const [station, setStation] = useState("loading...");
  const [scheduleTime, setScheduleTime] = useState("loading...");
  const [scheduleTime24, setScheduleTime24] = useState("loading...");

  // ---- scheduleId extraction that works with BrowserRouter AND HashRouter ----
  const scheduleId = useMemo(() => {
    try {
      const hash = window.location.hash || "";
      const hashPath = hash.startsWith("#") ? hash.slice(1) : hash;
      const base = hashPath || window.location.pathname || "";
      const pathOnly = base.split("?")[0];
      const parts = pathOnly.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || "";
      const id = decodeURIComponent(last);
      console.debug("[Boarding] scheduleId parsed =", id, "from base =", base);
      return id;
    } catch (e) {
      console.warn("[Boarding] scheduleId parse failed:", e);
      return "";
    }
  }, []);

  // ---------------------- server data for the route card ----------------------
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [stops, setStops] = useState([]);

  // ref to auto-scroll the current stop into view
  const currentStopRef = useRef(null);

  const [showManual, setShowManual] = useState(false);

  // ---------------------- helpers ----------------------
  const tokenHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "application/json" };
  };

  // Convert time to 12-hour format (hh:mm AM/PM)
  const to12h = (hhmmssOrDisplay) => {
    if (!hhmmssOrDisplay) return "";
    if (/[AP]M$/i.test(hhmmssOrDisplay.trim())) return hhmmssOrDisplay; // Already 12h format
    const [hStr = "0", mStr = "00"] = String(hhmmssOrDisplay).split(":");
    const h = parseInt(hStr, 10) || 0;
    const m = (mStr ?? "00").padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = (h % 12) || 12;
    return `${h12}:${m} ${ampm}`;
  };

  // Convert time to 24-hour format (HH:mm:ss), ensuring leading zero for single-digit hours
  const to24h = (hhmmssOrDisplay) => {
    if (!hhmmssOrDisplay) return "";
    if (/[AP]M$/i.test(hhmmssOrDisplay.trim())) {
      const [time, period] = hhmmssOrDisplay.trim().split(" ");
      let [h, m] = time.split(":").map(Number);
      if (period.toUpperCase() === "PM" && h !== 12) h += 12;
      if (period.toUpperCase() === "AM" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`; // Pad hour to two digits
    }
    return hhmmssOrDisplay; // Already in 24h format
  };

  // ---------------------- load route card data ----------------------
  useEffect(() => {
    if (!scheduleId) {
      setError("Missing scheduleId in URL. If using HashRouter, ensure path looks like #/station-boarding/<id>");
      return;
    }
    setLoading(true);
    setError("");

    const url = `${apiUrl}/api/boarding/routecard/${encodeURIComponent(scheduleId)}`;
    console.debug("[Boarding] Fetch routecard:", url);

    fetch(url, { headers: tokenHeaders() })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return body;
      })
      .then((payload) => {
        console.debug("[Boarding] routecard payload:", payload);
        setScheduleInfo(payload?.schedule_info || null);
        setStops(Array.isArray(payload?.stops) ? payload.stops : []);

        // Set the station and convert scheduleTime to 12-hour and 24-hour formats
        setStation(payload?.schedule_info?.station_name || "loading...");
        const depTime = payload?.schedule_info?.departure_time || "loading...";
        setScheduleTime(to12h(depTime));  // 12-hour format for route card
        setScheduleTime24(to24h(depTime)); // 24-hour format for passing to PassengerTable
      })
      .catch((e) => setError(e.message || "Failed to load route card"))
      .finally(() => setLoading(false));
  }, [scheduleId]);

  // ---------------------- compute header display ----------------------
  const headerTime = useMemo(() => {
    return scheduleTime; // Use the updated scheduleTime state in 12-hour format
  }, [scheduleTime]);

  const headerBoarded = useMemo(() => {
    if (scheduleInfo?.boarded_seats != null) return scheduleInfo.boarded_seats;
    return 0;
  }, [scheduleInfo]);

  const headerTotal = useMemo(() => {
    return scheduleInfo?.total_seats || 30; // Default total seats
  }, [scheduleInfo]);

  const headerPath = useMemo(() => {
    const dir = (scheduleInfo?.direction || "forward").toUpperCase();
    const routeOrStation = scheduleInfo?.route_name || station;
    return `${routeOrStation} — ${dir} DIRECTION`;
  }, [scheduleInfo, station]);

  const currentStopName = scheduleInfo?.station_name || station;
  const currentStopOrder = scheduleInfo?.stop_order ?? null;

  // auto-scroll the current stop into view when stops or current change
  useEffect(() => {
    if (currentStopRef.current) {
      currentStopRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [stops, currentStopOrder, currentStopName]);

  // ESC closes modals (manual)
  useEffect(() => {
    if (!showManual) return;
    const onKey = (e) => e.key === "Escape" && setShowManual(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showManual]);

  // render a status per stop relative to current stop
  const stopStatus = (stopOrder) => {
    if (currentStopOrder == null) return "";
    if (stopOrder < currentStopOrder) return "Departed";
    if (stopOrder === currentStopOrder) return "Arrived";
    return "Approaching";
  };

  const stopTimeToDisplay = (s) => {
    return to12h(s.stop_time || s.time || "");
  };

  return (
    <div className="boarding-landing-container">
      <StationNavbar />

      <div className="main-content">
        {/* Header with schedule box */}
        <header className="main-header">
          <div className="boarding-header-info">
            <h1>Boarding Management</h1>

            {/* ROUTE CARD */}
            <div className="route-card">
              <div className="route-card__top">
                <div className="route-card__path">{headerPath}</div>
                <div className="route-card__time">
                  {loading ? "Loading..." : headerTime || "—"} {/* 12-hour format */}
                </div>
                <div className="route-card__boarded">
                  Boarded:{" "}
                  <strong>
                    {loading ? "…" : headerBoarded}/{loading ? "…" : headerTotal}
                  </strong>
                </div>
              </div>

              <div className="stops-list">
                {error && (
                  <div className="stop-row">
                    <span className="stop-name" style={{ color: "red" }}>
                      {error}
                    </span>
                  </div>
                )}

                {!error && loading && (
                  <div className="stop-row">
                    <span className="stop-name">Loading stops…</span>
                  </div>
                )}

                {!error && !loading && (stops.length ? (
                  stops.map((s) => {
                    const isCurrent =
                      (s.station_name || "").toLowerCase() === (currentStopName || "").toLowerCase();
                    const timeStr = stopTimeToDisplay(s) || "—";
                    const statusStr = stopStatus(Number(s.stop_order ?? 0));
                    return (
                      <div
                        className={"stop-row" + (isCurrent ? " is-current" : "")}
                        key={`${s.station_id}-${s.stop_order}`}
                        ref={isCurrent ? currentStopRef : null}
                      >
                        <span className="stop-pin-slot" aria-hidden="true">
                          {isCurrent ? (
                            <span className="pin" aria-hidden="true">
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                width="18"
                                height="18"
                                aria-hidden="true"
                              >
                                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                              </svg>
                            </span>
                          ) : null}
                        </span>
                        <span className="stop-name">{s.station_name}</span>
                        <span className="stop-time">{timeStr}</span>
                        <span className="status">{statusStr}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="stop-row">
                    <span className="stop-name">
                      No stops found for this route. Check your <code>RouteStations</code> and that
                      the backend is returning <code>stop_time</code> per stop.
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* END ROUTE CARD */}
          </div>

          <LogoutButton />
        </header>

        {/* Buttons */}
        <section className="actions-bar">
          <ScanButtonModule action="boarding" /> {/* Pass the boarding action */}
          <button className="manual-booking-btn" onClick={() => setShowManual(true)}>
            <span className="btn-icon">📝</span>
            Manual Booking
          </button>
        </section>

        {/* Passenger Table (pass origin and scheduleTime props to PassengerTable) */}
        <PassengerTable origin={station} scheduleTime={scheduleTime24} /> {/* 24-hour format */}
      </div>

      {/* Manual Booking Modal */}
      <ManualBookingModal
        open={showManual}
        onClose={() => setShowManual(false)}
        existingRows={[]}
      />
    </div>
  );
}
