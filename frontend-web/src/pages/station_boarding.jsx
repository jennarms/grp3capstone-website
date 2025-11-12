import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_boarding.css";

import ManualBookingModal from "../modules/ManualBooking/ManualBookingModal.jsx";
import PassengerTable from "../modules/PassengerTable.jsx";
import ScanButtonModule from "../modules/ScanButtonModule.jsx";

const apiUrl = import.meta.env.VITE_API_URL;

export function Boarding() {
  const [station, setStation] = useState("loading...");
  const [scheduleTime, setScheduleTime] = useState("loading...");
  const [scheduleTime24, setScheduleTime24] = useState("loading...");
  const [seatsTaken, setSeatsTaken] = useState(0); // State for seats taken count
  const [error, setError] = useState("");

  // Works with BrowserRouter & HashRouter
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
  }, []); // Schedule ID based on the URL

  const [loading, setLoading] = useState(false);
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [stops, setStops] = useState([]);

  const currentStopRef = useRef(null);
  const [showManual, setShowManual] = useState(false);

  const tokenHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "application/json" };
  };

  const to12h = (hhmmssOrDisplay) => {
    if (!hhmmssOrDisplay) return "";
    if (/[AP]M$/i.test(hhmmssOrDisplay.trim())) return hhmmssOrDisplay;
    const [hStr = "0", mStr = "00"] = String(hhmmssOrDisplay).split(":");
    const h = parseInt(hStr, 10) || 0;
    const m = (mStr ?? "00").padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = (h % 12) || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const to24h = (hhmmssOrDisplay) => {
    if (!hhmmssOrDisplay) return "";
    if (/[AP]M$/i.test(hhmmssOrDisplay.trim())) {
      const [time, period] = hhmmssOrDisplay.trim().split(" ");
      let [h, m] = time.split(":").map(Number);
      if (period.toUpperCase() === "PM" && h !== 12) h += 12;
      if (period.toUpperCase() === "AM" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    }
    return hhmmssOrDisplay;
  };

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

        setStation(payload?.schedule_info?.station_name || "loading...");
        const depTime = payload?.schedule_info?.departure_time || "loading...";
        setScheduleTime(to12h(depTime));  // 12-hour format for route card
        setScheduleTime24(to24h(depTime)); // 24-hour format for passing to PassengerTable

        // Fetch seats taken data for the given schedule and update state
        const { date, origin, departure_time } = payload?.schedule_info || {};
        if (date && origin && departure_time) {
          const seatsUrl = `${apiUrl}/api/boarding/count-seats-taken?date=${date}&origin=${origin}&departure_time=${departure_time}&schedule_id=${scheduleId}`;
          console.log("Seats URL:", seatsUrl); // Log to confirm URL is correct

          fetch(seatsUrl, { headers: tokenHeaders() })
            .then((res) => res.json())
            .then((data) => {
              console.log("Seats taken API response:", data);  // Log the response to check if it's valid
              if (data.seats_taken !== undefined) {
                setSeatsTaken(data.seats_taken);  // Update state with correct value
                console.log("Seats taken state updated to:", data.seats_taken);  // Ensure it's set correctly
              } else {
                console.error("Invalid response data for seats_taken");
              }
            })
            .catch((err) => setError(err.message || "Failed to load seats data"));
        }
      })
      .catch((e) => setError(e.message || "Failed to load route card"))
      .finally(() => setLoading(false));
  }, [scheduleId]);

  const headerTime = useMemo(() => scheduleTime, [scheduleTime]);

  const headerSeatsTaken = useMemo(() => {
    console.log("Rendering with seats_taken:", seatsTaken);  // Log state value to confirm it's correct
    return seatsTaken != null ? seatsTaken : 0;
  }, [seatsTaken]);

  useEffect(() => {
    console.log("Seats Taken updated:", seatsTaken); // Log to check if the state changes
  }, [seatsTaken]);

  const headerPath = useMemo(() => {
    const dir = (scheduleInfo?.direction || "forward").toUpperCase();
    return `${station} — ${dir} DIRECTION`;
  }, [station, scheduleInfo?.direction]);

  const currentStopName = scheduleInfo?.station_name || station;
  const currentStopOrder = scheduleInfo?.stop_order ?? null;

  useEffect(() => {
    if (currentStopRef.current) {
      currentStopRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [stops, currentStopOrder, currentStopName]);

  useEffect(() => {
    if (!showManual) return;
    const onKey = (e) => e.key === "Escape" && setShowManual(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showManual]);

  const stopTimeToDisplay = (s) => to12h(s.stop_time || s.time || "");

  return (
    <div className="boarding-landing-container">
      <StationNavbar />

      <div className="main-content">
        <header className="main-header">
          <div className="boarding-header-info">
            <h1>Boarding Management</h1>

            {/* ROUTE CARD */}
            <div className="route-card">
              <div className="route-card__top">
                <div className="route-card__path">{headerPath}</div>
                <div className="route-card__time">
                  {loading ? "Loading..." : headerTime || "—"}
                </div>
                <div className="route-card__seats-taken">
                  Number of Seats Taken:{" "}
                  <strong>
                    {loading ? "…" : headerSeatsTaken}/{loading ? "…" : scheduleInfo?.total_seats}
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

                {!error && !loading && stops.length ? (
                  stops.map((s) => {
                    const isCurrent =
                      (s.station_name || "").toLowerCase() === (currentStopName || "").toLowerCase();
                    const timeStr = stopTimeToDisplay(s) || "—";
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
                                {/* fixed path */}
                                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                              </svg>
                            </span>
                          ) : null}
                        </span>
                        <span className="stop-name">{s.station_name}</span>
                        <span className="stop-time">{timeStr}</span>
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
                )}
              </div>
            </div>
            {/* END ROUTE CARD */}
          </div>

          <LogoutButton />
        </header>

        {/* Actions */}
        <section className="actions-bar">
          <ScanButtonModule action="boarding" />
          {/* make this the same navy style */}
          <button className="scan-btn" onClick={() => setShowManual(true)}>
            <span className="btn-icon">📝</span>
            Manual Booking
          </button>
        </section>

        {/* Passenger Table */}
        <PassengerTable origin={station} scheduleTime={scheduleTime24} />
      </div>

      {/* Manual Booking Modal */}
      <ManualBookingModal open={showManual} onClose={() => setShowManual(false)} existingRows={[]} />
    </div>
  );
}
