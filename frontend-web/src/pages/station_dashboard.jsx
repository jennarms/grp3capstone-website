import { useCallback, useEffect, useMemo, useState } from "react";
import "./station_dashboard.css";

import { StationNavbar } from "../components/station_navbar";
import { LogoutButton } from "../components/logout_button";
import { dashboardService } from "../services/api"; // ✅ ADDED

function StationDashboard() {
  const [forwardSchedules, setForwardSchedules] = useState([]);
  const [reverseSchedules, setReverseSchedules] = useState([]);
  const [stationName, setStationName] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totals, setTotals] = useState({ total_forward: 0, total_reverse: 0, total_schedules: 0 });

  // Announcements (same shape as old dashboard: body is an array of lines)
  const announcements = [
    { title: "Scheduled System Maintenance", body: [
      "Please be informed that the MetroLayag Passenger Management System will undergo scheduled maintenance on:",
      "Date: May 25, 2025",
      "Time: 3:00 PM - 5:00 PM PHT",
    ]},
    { title: "Weather Advisory", body: [
      "Expect intermittent rain showers in the afternoon.",
      "Some trips may be delayed by 10–15 minutes for safety checks.",
    ]},
    { title: "New Boarding Flow", body: [
      "Starting next week, boarding gates will open 20 minutes before departure.",
      "Please have your QR code ready at the gate.",
    ]},
    { title: "Lost & Found Reminder", body: [
      "Items are kept for 30 days at the PUP Station office.",
      "Bring a valid ID to claim.",
    ]},
    { title: "System Update", body: [
      "We've improved seat availability syncing across stations.",
      "Report any glitches via the Help menu.",
    ]},
  ];

  const fetchBoardingSchedules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // ✅ UPDATED: Using API service instead of direct fetch
      const data = await dashboardService.getBoardingSchedules(selectedDate);

      const f = Array.isArray(data.forward_schedules) ? data.forward_schedules : [];
      const r = Array.isArray(data.reverse_schedules) ? data.reverse_schedules : [];

      setStationName(data.station_name || "Unknown Station");
      setForwardSchedules(f);
      setReverseSchedules(r);

      // Prefer API totals if present, else compute
      const tf = typeof data.total_forward === "number" ? data.total_forward : f.length;
      const tr = typeof data.total_reverse === "number" ? data.total_reverse : r.length;
      const ts = typeof data.total_schedules === "number" ? data.total_schedules : tf + tr;
      setTotals({ total_forward: tf, total_reverse: tr, total_schedules: ts });
    } catch (e) {
      setError(e.message);
      setForwardSchedules([]);
      setReverseSchedules([]);
      setTotals({ total_forward: 0, total_reverse: 0, total_schedules: 0 });
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchBoardingSchedules();
  }, [fetchBoardingSchedules]);

  // ---- helpers ----
  const formatTime = (hhmmss) => {
    if (!hhmmss) return "";
    const [hStr = "0", mStr = "00"] = String(hhmmss).split(":");
    const h = parseInt(hStr, 10) || 0;
    const m = (mStr ?? "00").padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  // Build combined rows (TIME ONLY) so forward/reverse appear side-by-side
  const combinedRows = useMemo(() => {
    const rows = [];
    const maxLen = Math.max(forwardSchedules.length, reverseSchedules.length);
    for (let i = 0; i < maxLen; i++) {
      const f = forwardSchedules[i];
      const r = reverseSchedules[i];
      rows.push({
        fTime: f ? formatTime(f.departure_time) : "",
        rTime: r ? formatTime(r.departure_time) : "",
      });
    }
    return rows;
  }, [forwardSchedules, reverseSchedules]);

  return (
    <div className="sd-container">
      <StationNavbar />

      <main className="sd-main">
        {/* Header */}
        <header className="sd-header">
          <h1 className="sd-title">Station Dashboard – {stationName}</h1>
          <div className="sd-controls">
            <label className="sd-date-label">
              Date:
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </label>
            <button className="sd-refresh" onClick={fetchBoardingSchedules} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
            <LogoutButton />
          </div>
        </header>

        {/* TOTAL ONLY */}
        <section className="sd-stats sd-stats--total-only">
          <div className="sd-stat">
            <div className="sd-stat-label">Number of Schedules</div>
            <div className="sd-stat-value">{totals.total_schedules}</div>
          </div>
        </section>

        {error && <div className="sd-error"><strong>Error:</strong> {error}</div>}

        {/* ONE combined table: Forward (left) | Reverse (right) — TIME ONLY */}
        <section className="sd-card">
          <div className="sd-table-wrapper sd-table-wrapper--tall">
            <table className="sd-data-table sd-data-table--combined sd-data-table--time-only">
              <thead>
                <tr>
                  <th className="sd-caption-th" colSpan={2}>
                    {stationName} — Forward / Reverse Schedules (Total: {totals.total_schedules})
                  </th>
                </tr>
                <tr>
                  <th className="sd-side-head">Forward ({totals.total_forward})</th>
                  <th className="sd-side-head">Reverse ({totals.total_reverse})</th>
                </tr>
                <tr>
                  <th className="sd-col-head">Time</th>
                  <th className="sd-col-head">Time</th>
                </tr>
              </thead>
              <tbody>
                {combinedRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="sd-empty">
                      {loading ? "Loading schedules..." : "No schedules available for the selected date"}
                    </td>
                  </tr>
                ) : (
                  combinedRows.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.fTime}</td>
                      <td>{row.rTime}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ====== Announcements (copied from old dashboard) ====== */}
        <h2 className="station-title-announcement">GENERAL ANNOUNCEMENTS</h2>
        <section className="station-announcements station-announcements--scroll">
          {announcements.map((a, i) => (
            <div className="station-announcement-card" key={i}>
              <h3>{a.title}</h3>
              {a.body.map((line, j) => (
                <p key={j}>{line}</p>
              ))}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default StationDashboard;
export { StationDashboard };