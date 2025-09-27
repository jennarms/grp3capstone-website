import { useCallback, useEffect, useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_boardingLanding.css";

const apiUrl = import.meta.env.VITE_API_URL;
console.log("API URL from env:", apiUrl);

export function BoardingLandingPage() {
  const [forwardSchedules, setForwardSchedules] = useState([]);
  const [reverseSchedules, setReverseSchedules] = useState([]);
  const [stationName, setStationName] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Get auth token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Fetch boarding schedules
  const fetchBoardingSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      
      console.log("Fetching schedules for date:", selectedDate);
      
      const response = await fetch(`${apiUrl}/api/landingboarding/boarding-schedules?date=${selectedDate}`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        
        // Debug logging
        console.log("Raw response data:", data);
        console.log("Forward schedules:", data.forward_schedules);
        console.log("Reverse schedules:", data.reverse_schedules);
        console.log("Forward schedules length:", data.forward_schedules?.length || 0);
        console.log("Reverse schedules length:", data.reverse_schedules?.length || 0);
        
        setStationName(data.station_name || "Unknown Station");
        setForwardSchedules(data.forward_schedules || []);
        setReverseSchedules(data.reverse_schedules || []);
        
        // Additional debug after state update
        console.log("State will be updated with:");
        console.log("- Forward:", data.forward_schedules || []);
        console.log("- Reverse:", data.reverse_schedules || []);
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to fetch schedules`;
        console.error("API Error:", errorMessage);
        setError(errorMessage);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError('Network error: ' + err.message);
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

  // Format time for display
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      console.error("Time formatting error:", error, "for time:", timeStr);
      return timeStr; // Return original if formatting fails
    }
  };

  // Handle view button click
  const handleViewClick = (scheduleId) => {
    // Navigate to boarding page with schedule ID and date
    window.location.href = `/station-boarding/${scheduleId}?date=${selectedDate}`;
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label>
              Date: 
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => {
                  console.log("Date changed to:", e.target.value);
                  setSelectedDate(e.target.value);
                }}
                style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
              />
            </label>
            <button 
              onClick={handleRefresh}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#007bff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <LogoutButton />
          </div>
        </header>

        {error && (
          <div style={{ color: 'red', padding: '1rem', backgroundColor: '#ffe6e6', margin: '1rem 0', borderRadius: '4px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div>Loading schedules...</div>
          </div>
        )}

        {/* Debug info - remove this in production */}
        {!loading && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            margin: '1rem 0', 
            borderRadius: '4px', 
            fontSize: '0.875rem',
            color: '#666'
          }}>
            <strong>Debug Info:</strong> Forward: {forwardSchedules.length} schedules, 
            Reverse: {reverseSchedules.length} schedules
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
                      <td colSpan={3} style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                        {loading ? 'Loading...' : 'No forward schedules available'}
                      </td>
                    </tr>
                  ) : (
                    forwardSchedules.map((schedule, i) => {
                      console.log(`Rendering forward schedule ${i}:`, schedule);
                      return (
                        <tr key={`f-${schedule.schedule_id}-${i}`}>
                          <td>{formatTime(schedule.departure_time)}</td>
                          <td>{schedule.available_seats} / {schedule.total_seats}</td>
                          <td className="blp-action-cell">
                            <button 
                              className="blp-view-btn"
                              onClick={() => handleViewClick(schedule.schedule_id)}
                              disabled={loading}
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
                      <td colSpan={3} style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                        {loading ? 'Loading...' : 'No reverse schedules available'}
                      </td>
                    </tr>
                  ) : (
                    reverseSchedules.map((schedule, i) => {
                      console.log(`Rendering reverse schedule ${i}:`, schedule);
                      return (
                        <tr key={`r-${schedule.schedule_id}-${i}`}>
                          <td>{formatTime(schedule.departure_time)}</td>
                          <td>{schedule.available_seats} / {schedule.total_seats}</td>
                          <td className="blp-action-cell">
                            <button 
                              className="blp-view-btn"
                              onClick={() => handleViewClick(schedule.schedule_id)}
                              disabled={loading}
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