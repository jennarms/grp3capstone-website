import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Row refs for auto-scroll + highlight
  const forwardRowRefs = useRef([]);
  const reverseRowRefs = useRef([]);

  // Log once so we know which API base URL this component uses
  useEffect(() => {
    console.log("[BLP] Mounted. apiUrl =", apiUrl);
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    };
  };

  const normalizeSchedules = (list, label) => {
    const norm = Array.isArray(list)
      ? list.map((s) => ({
          ...s,
          available_seats: Number(s.available_seats ?? 0),
          total_seats: Number(s.total_seats ?? 0),
          booked_seats: Number(s.booked_seats ?? 0),
        }))
      : [];

    console.log(`[BLP] Normalized ${label} schedules:`, norm);
    return norm;
  };

  const fetchBoardingSchedules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      console.log("[BLP] Fetching schedules for date:", selectedDate);
      const url = `${apiUrl}/api/landingboarding/boarding-schedules?date=${encodeURIComponent(
        selectedDate
      )}`;
      console.log("[BLP] Request URL:", url);

      const res = await fetch(url, { headers: getAuthHeaders() });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[BLP] Error response body:", body);
        const msg = body?.error || `HTTP ${res.status}: Failed to fetch schedules`;
        setError(msg);
        setForwardSchedules([]);
        setReverseSchedules([]);
        return;
      }

      const raw = await res.json();
      console.log("[BLP] RAW API data:", raw);

      const fNorm = normalizeSchedules(raw.forward_schedules, "forward");
      const rNorm = normalizeSchedules(raw.reverse_schedules, "reverse");

      setStationName(raw.station_name || "Unknown Station");
      setForwardSchedules(fNorm);
      setReverseSchedules(rNorm);
    } catch (e) {
      console.error("[BLP] Network or parsing error:", e);
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

  // ---------- helpers ----------
  const parseDateTime = (dateStr, hhmmss) => {
    if (!dateStr || !hhmmss) return null;
    const [Y, M, D] = dateStr.split("-").map(Number);
    const [hh = "0", mm = "0", ss = "0"] = String(hhmmss).split(":");
    const dt = new Date();
    dt.setFullYear(Y, (M || 1) - 1, D || 1);
    dt.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, parseInt(ss, 10) || 0, 0);
    return dt;
  };

  const formatTime = (hhmmss) => {
    if (!hhmmss) return "";
    const [hStr = "0", mStr = "00"] = String(hhmmss).split(":");
    const h = parseInt(hStr, 10) || 0;
    const m = (mStr ?? "00").padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  // Stable finder for the next upcoming index for a given list
  const nextIndexFor = useCallback(
    (schedules) => {
      if (!Array.isArray(schedules) || schedules.length === 0) return -1;

      const today = new Date();
      const selectedMidnight = new Date(selectedDate + "T00:00:00");
      const todayMidnight = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      if (selectedMidnight > todayMidnight) return 0; // future date -> first row
      if (selectedMidnight < todayMidnight) return -1; // past date -> none

      // selected date === today: find first time >= now
      const now = Date.now();
      for (let i = 0; i < schedules.length; i++) {
        const dep = parseDateTime(selectedDate, schedules[i]?.departure_time);
        if (dep && dep.getTime() >= now) return i;
      }
      return -1;
    },
    [selectedDate]
  );

  // Memoized indices for the "next" rows (deps satisfied)
  const nextForwardIndex = useMemo(
    () => nextIndexFor(forwardSchedules),
    [forwardSchedules, nextIndexFor]
  );
  const nextReverseIndex = useMemo(
    () => nextIndexFor(reverseSchedules),
    [reverseSchedules, nextIndexFor]
  );

  // ---------- Auto-scroll ----------
  useEffect(() => {
    const t = setTimeout(() => {
      const elF =
        nextForwardIndex >= 0 ? forwardRowRefs.current[nextForwardIndex] : null;
      if (elF && typeof elF.scrollIntoView === "function") {
        elF.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [nextForwardIndex, forwardSchedules]);

  useEffect(() => {
    const t = setTimeout(() => {
      const elR =
        nextReverseIndex >= 0 ? reverseRowRefs.current[nextReverseIndex] : null;
      if (elR && typeof elR.scrollIntoView === "function") {
        elR.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [nextReverseIndex, reverseSchedules]);

  // ---------- navigation ----------
  const goToBoarding = ({
    scheduleId,
    departureTimeHHMMSS,
    availableSeats,
    totalSeats,
    direction,
  }) => {
    const formattedTime = formatTime(departureTimeHHMMSS);
    const availNum = Number(availableSeats || 0);
    const totalNum = Number(totalSeats || 0);
    const booked = Math.max(0, totalNum - availNum);

    console.log("[BLP] goToBoarding clicked:", {
      scheduleId,
      departureTimeHHMMSS,
      availableSeats,
      totalSeats,
      booked,
      direction,
    });

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

    if (window.location.hash) {
      window.location.hash = "#" + (path + search).replace(/^\//, "");
    } else {
      navigate({ pathname: path, search });
    }
  };

  // helpers to set row refs in map
  const setForwardRef = (el, idx) => {
    forwardRowRefs.current[idx] = el;
  };
  const setReverseRef = (el, idx) => {
    reverseRowRefs.current[idx] = el;
  };

  const rowClass = (isNext) => "blp-row" + (isNext ? " blp-row-highlight" : "");

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

        <section className="blp-table-section">
          {/* FORWARD */}
          <div className="blp-card">
            <div className="blp-table-wrapper">
              <table className="blp-data-table">
                <thead>
                  <tr className="blp-caption-row">
                    <th className="blp-caption-th" colSpan={3}>
                      {stationName} - FORWARD DIRECTION (
                      {forwardSchedules.length} schedules)
                    </th>
                  </tr>
                  <tr className="blp-cols-row">
                    <th>Time</th>
                    <th>Seats</th>
                    <th className="blp-action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {forwardSchedules.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: "center", padding: "1rem", color: "#666" }}
                      >
                        {loading ? "Loading..." : "No forward schedules available"}
                      </td>
                    </tr>
                  ) : (
                    forwardSchedules.map((s, i) => {
                      const isNext = i === nextForwardIndex;
                      return (
                        <tr
                          key={`f-${s.schedule_id}-${i}`}
                          ref={(el) => setForwardRef(el, i)}
                          className={rowClass(isNext)}
                        >
                          <td>{formatTime(s.departure_time)}</td>
                          <td>
                            Available: {s.available_seats} / {s.total_seats}{" "}
                            (<strong>Booked: {s.booked_seats}</strong>)
                          </td>
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
                              title={isNext ? "Next upcoming schedule" : undefined}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
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
                      {stationName} - REVERSE DIRECTION (
                      {reverseSchedules.length} schedules)
                    </th>
                  </tr>
                  <tr className="blp-cols-row">
                    <th>Time</th>
                    <th>Seats</th>
                    <th className="blp-action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reverseSchedules.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ textAlign: "center", padding: "1rem", color: "#666" }}
                      >
                        {loading ? "Loading..." : "No reverse schedules available"}
                      </td>
                    </tr>
                  ) : (
                    reverseSchedules.map((s, i) => {
                      const isNext = i === nextReverseIndex;
                      return (
                        <tr
                          key={`r-${s.schedule_id}-${i}`}
                          ref={(el) => setReverseRef(el, i)}
                          className={rowClass(isNext)}
                        >
                          <td>{formatTime(s.departure_time)}</td>
                          <td>
                            Available: {s.available_seats} / {s.total_seats}{" "}
                            (<strong>Booked: {s.booked_seats}</strong>)
                          </td>
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
                              title={isNext ? "Next upcoming schedule" : undefined}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
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
