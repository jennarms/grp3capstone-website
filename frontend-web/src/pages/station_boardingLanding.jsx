// src/pages/station_boardingLanding.jsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ SPA navigation (works with BrowserRouter & HashRouter)
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_boardingLanding.css";

const apiUrl = import.meta.env.VITE_API_URL;
console.log("API URL from env:", apiUrl);

export function BoardingLandingPage() {
  const navigate = useNavigate(); // ✅

  const [forwardSchedules, setForwardSchedules] = useState([]);
  const [reverseSchedules, setReverseSchedules] = useState([]);
  const [stationName, setStationName] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Get auth token
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  // Fetch boarding schedules
  const fetchBoardingSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      console.log("Fetching schedules for date:", selectedDate);

      const response = await fetch(
        `${apiUrl}/api/landingboarding/boarding-schedules?date=${selectedDate}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();

        // Debug logging
        console.log("Raw response data:", data);
        console.log("Forward schedules:", data.forward_schedules);
        console.log("Reverse schedules:", data.reverse_schedules);

        setStationName(data.station_name || "Unknown Station");
        setForwardSchedules(data.forward_schedules || []);
        setReverseSchedules(data.reverse_schedules || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `HTTP ${response.status}: Failed to fetch schedules`;
        console.error("API Error:", errorMessage);
        setError(errorMessage);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Load schedules on component mount and date change
  useEffect(() => {
    fetchBoardingSchedules();
  }, [fetchBoardingSchedules]);

  // Debug effect to log state changes
  useEffect(() => {
    console.log("State updated - Forward schedules:", forwardSchedules);
    console.log("State updated - Reverse schedules:", reverseSchedules);
  }, [forwardSchedules, reverseSchedules]);

  // Format time for display (24h → 12h)
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const [hRaw, mRaw] = String(timeStr).split(":");
      const hours = parseInt(hRaw, 10);
      const minutes = (mRaw ?? "00").padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHour = (hours % 12) || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      console.error("Time formatting error:", error, "for time:", timeStr);
      return timeStr;
    }
  };

  // ✅ Single helper to navigate to the Boarding page — works for both HashRouter & BrowserRouter
  const goToBoarding = ({
    scheduleId,
    departureTime24,
    availableSeats,
    totalSeats,
    direction,
  }) => {
    const formattedTime = formatTime(departureTime24);
    const availNum = Number(availableSeats || 0);
    const totalNum = Number(totalSeats || 0);
    const booked = Math.max(0, totalNum - availNum);

    const params = new URLSearchParams({
      date: selectedDate,
      time: formattedTime,
      avail: String(availNum),
      total: String(totalNum),
      booked: String(booked),
      dir: String(direction || "forward"),
      station: stationName || "",
    });

    const path = `/station-boarding/${encodeURIComponent(String(scheduleId))}`;
    const search = `?${params.toString()}`;

    // If using HashRouter, put the whole SPA path into the hash to avoid duplicate paths
    if (window.location.hash) {
      window.location.hash = "#" + (path + search).replace(/^\//, "");
    } else {
      // BrowserRouter path navigation
      navigate({ pathname: path, search });
    }
  };

  // Handle refresh button
  const handleRefresh = () => {
    console.log("Manual refresh triggered");
    fetchBoardingSchedules();
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
                onChange={(e) => {
                  console.log("Date changed to:", e.target.value);
                  setSelectedDate(e.target.value);
                }}
                style={{ marginLeft: "0.5rem", padding: "0.25rem" }}
              />
            </label>
            <button
              onClick={handleRefresh}
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

        {/* Debug info */}
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
          {/* FORWARD DIRECTION TABLE */}
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
                    forwardSchedules.map((schedule, i) => (
                      <tr key={`f-${schedule.schedule_id}-${i}`}>
                        <td>{formatTime(schedule.departure_time)}</td>
                        <td>
                          {schedule.available_seats} / {schedule.total_seats}
                        </td>
                        <td className="blp-action-cell">
                          <button
                            className="blp-view-btn"
                            onClick={() =>
                              goToBoarding({
                                scheduleId: schedule.schedule_id,
                                departureTime24: schedule.departure_time,
                                availableSeats: schedule.available_seats,
                                totalSeats: schedule.total_seats,
                                direction: "forward",
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

          {/* REVERSE DIRECTION TABLE */}
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
                    reverseSchedules.map((schedule, i) => (
                      <tr key={`r-${schedule.schedule_id}-${i}`}>
                        <td>{formatTime(schedule.departure_time)}</td>
                        <td>
                          {schedule.available_seats} / {schedule.total_seats}
                        </td>
                        <td className="blp-action-cell">
                          <button
                            className="blp-view-btn"
                            onClick={() =>
                              goToBoarding({
                                scheduleId: schedule.schedule_id,
                                departureTime24: schedule.departure_time,
                                availableSeats: schedule.available_seats,
                                totalSeats: schedule.total_seats,
                                direction: "reverse",
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
