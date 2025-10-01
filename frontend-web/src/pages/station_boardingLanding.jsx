import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_boardingLanding.css";

const apiUrl = import.meta.env.VITE_API_URL;

export function BoardingLandingPage() {
  const navigate = useNavigate();

  const [forwardSchedules, setForwardSchedules] = useState([]);
  const [reverseSchedules, setReverseSchedules] = useState([]);
  const [stationName, setStationName] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    };
  };

  const fetchBoardingSchedules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${apiUrl}/api/landingboarding/boarding-schedules?date=${encodeURIComponent(selectedDate)}`,
        { headers: getAuthHeaders() }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error || `HTTP ${res.status}: Failed to fetch schedules`;
        setError(msg);
        setForwardSchedules([]);
        setReverseSchedules([]);
        return;
      }

      const data = await res.json();
      setStationName(data.station_name || "Unknown Station");
      setForwardSchedules(Array.isArray(data.forward_schedules) ? data.forward_schedules : []);
      setReverseSchedules(Array.isArray(data.reverse_schedules) ? data.reverse_schedules : []);
    } catch (e) {
      setError(`Network error: ${e.message}`);
      setForwardSchedules([]);
      setReverseSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchBoardingSchedules();
  }, [fetchBoardingSchedules]);

  // "HH:MM:SS" -> "h:mm AM/PM"
  const formatTime = (hhmmss) => {
    if (!hhmmss) return "";
    const [hStr = "0", mStr = "00"] = String(hhmmss).split(":");
    const h = parseInt(hStr, 10) || 0;
    const m = (mStr ?? "00").padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = (h % 12) || 12;
    return `${h12}:${m} ${ampm}`;
  };

  // Navigate to station boarding page for a schedule instance
  const goToBoarding = ({ scheduleId, departureTimeHHMMSS, availableSeats, totalSeats, direction }) => {
    const formattedTime = formatTime(departureTimeHHMMSS);
    const availNum = Number(availableSeats || 0);
    const totalNum = Number(totalSeats || 0);
    const booked = Math.max(0, totalNum - availNum);

    const params = new URLSearchParams({
      date: selectedDate,
      time: formattedTime,             // UI display only
      avail: String(availNum),
      total: String(totalNum),
      booked: String(booked),
      dir: String(direction || "forward"),
      station: stationName || "",
    });

    const path = `/station-boarding/${encodeURIComponent(String(scheduleId))}`;
    const search = `?${params.toString()}`;

    if (window.location.hash) {
      window.location.hash = "#" + (path + search).replace(/^\//, "");
    } else {
      navigate({ pathname: path, search });
    }
  };

  return (
    <div className="blp-container">
      <StationNavbar />

      <div className="blp-main">
        <header className="blp-header">
          <h1>Boarding Management - {stationName}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <label>
              Date:
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ marginLeft: "0.5rem", padding: "0.25rem" }}
              />
            </label>
            <button
              onClick={fetchBoardingSchedules}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
            <LogoutButton />
          </div>
        </header>

        {error && (
          <div
            style={{
              color: "red",
              padding: "1rem",
              backgroundColor: "#ffe6e6",
              margin: "1rem 0",
              borderRadius: "4px",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div>Loading schedules...</div>
          </div>
        )}

        {!loading && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f8f9fa",
              margin: "1rem 0",
              borderRadius: "4px",
              fontSize: "0.875rem",
              color: "#666",
            }}
          >
            <strong>Debug Info:</strong> Forward: {forwardSchedules.length} schedules, Reverse:{" "}
            {reverseSchedules.length} schedules
          </div>
        )}

        <section className="blp-table-section">
          {/* FORWARD */}
          <div className="blp-card">
            <div className="blp-table-wrapper">
              <table className="blp-data-table">
                <thead>
                  <tr className="blp-caption-row">
                    <th className="blp-caption-th" colSpan={3}>
                      {stationName} - FORWARD DIRECTION ({forwardSchedules.length} schedules)
                    </th>
                  </tr>
                  <tr className="blp-cols-row">
                    <th>Time</th>
                    <th>Available Seats</th>
                    <th className="blp-action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {forwardSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "1rem", color: "#666" }}>
                        {loading ? "Loading..." : "No forward schedules available"}
                      </td>
                    </tr>
                  ) : (
                    forwardSchedules.map((s, i) => (
                      <tr key={`f-${s.schedule_id}-${i}`}>
                        <td>{formatTime(s.departure_time)}</td>
                        <td>{s.available_seats} / {s.total_seats}</td>
                        <td className="blp-action-cell">
                          <button
                            className="blp-view-btn"
                            onClick={() =>
                              goToBoarding({
                                scheduleId: s.schedule_id,
                                departureTimeHHMMSS: s.departure_time,
                                availableSeats: s.available_seats,
                                totalSeats: s.total_seats,
                                direction: s.direction || "forward",
                              })
                            }
                            disabled={loading}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* REVERSE */}
          <div className="blp-card">
            <div className="blp-table-wrapper">
              <table className="blp-data-table">
                <thead>
                  <tr className="blp-caption-row">
                    <th className="blp-caption-th" colSpan={3}>
                      {stationName} - REVERSE DIRECTION ({reverseSchedules.length} schedules)
                    </th>
                  </tr>
                  <tr className="blp-cols-row">
                    <th>Time</th>
                    <th>Available Seats</th>
                    <th className="blp-action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reverseSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "1rem", color: "#666" }}>
                        {loading ? "Loading..." : "No reverse schedules available"}
                      </td>
                    </tr>
                  ) : (
                    reverseSchedules.map((s, i) => (
                      <tr key={`r-${s.schedule_id}-${i}`}>
                        <td>{formatTime(s.departure_time)}</td>
                        <td>{s.available_seats} / {s.total_seats}</td>
                        <td className="blp-action-cell">
                          <button
                            className="blp-view-btn"
                            onClick={() =>
                              goToBoarding({
                                scheduleId: s.schedule_id,
                                departureTimeHHMMSS: s.departure_time,
                                availableSeats: s.available_seats,
                                totalSeats: s.total_seats,
                                direction: s.direction || "reverse",
                              })
                            }
                            disabled={loading}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
