import { useCallback, useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_schedulesTab.css";

export function SchedulesTab() {
  const apiUrl = import.meta.env.VITE_API_URL;

  // Data
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stations, setStations] = useState([]);
  const [schedules, setSchedules] = useState([]);

  // UI state
  const [editingRideId, setEditingRideId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modals
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [showDeleteRow, setShowDeleteRow] = useState(false);
  const [rideIdToDelete, setRideIdToDelete] = useState(null);

  const getAuthToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token") || "";

  const apiCall = useCallback(
    async (endpoint, options = {}) => {
      const token = getAuthToken();
      const url = `${apiUrl}${endpoint}`;

      const resp = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });

      if (!resp.ok) {
        let msg = `HTTP ${resp.status}`;
        try {
          const j = await resp.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      return resp.json();
    },
    [apiUrl]
  );

  // Fetch routes
  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall("/api/schedules/routes");
      setRoutes(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length && !selectedRoute) {
        setSelectedRoute(data[0]);
      }
    } catch (e) {
      setError(`Failed to fetch routes: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [apiCall, selectedRoute]);

  // Fetch stations for a route
  const fetchStations = useCallback(
    async (routeId) => {
      if (!routeId) return;
      try {
        setLoading(true);
        const data = await apiCall(
          `/api/schedules/stations?Route_ID=${encodeURIComponent(routeId)}`
        );
        setStations(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(`Failed to fetch stations: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Fetch schedules for a route
  const fetchSchedules = useCallback(
    async (routeId) => {
      if (!routeId) return;
      try {
        setLoading(true);
        const data = await apiCall(
          `/api/schedules/by-route?Route_ID=${encodeURIComponent(routeId)}`
        );
        setSchedules(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(`Failed to fetch schedules: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Lifecycle
  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    if (selectedRoute?.Route_ID) {
      fetchStations(selectedRoute.Route_ID);
      fetchSchedules(selectedRoute.Route_ID);
    }
  }, [selectedRoute, fetchStations, fetchSchedules]);

  // Helpers
  const formatTimeForDisplay = (timeStr) => {
    if (!timeStr) return "";
    try {
      const [hStr, mStr] = timeStr.split(":");
      let h = parseInt(hStr, 10);
      const m = mStr ?? "00";
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      return `${h}:${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  // Handlers
  const handleRouteChange = (e) => {
    const value = e.target.value;
    const found = routes.find((r) => String(r.Route_ID) === String(value));
    setSelectedRoute(found || null);
    setSchedules([]);
    setEditingRideId(null);
  };

  const onCellChange = (rideId, routeStationId, value) => {
    setSchedules((prev) =>
      prev.map((ride) =>
        ride.Ride_ID === rideId
          ? {
              ...ride,
              stations: ride.stations.map((s) =>
                s.RouteStation_ID === routeStationId
                  ? { ...s, departureTime: value }
                  : s
              ),
            }
          : ride
      )
    );
  };

  const createRide = async () => {
    if (!selectedRoute?.Route_ID || !stations.length) return;
    const departureTimes = stations.map((st) => ({
      RouteStation_ID: st.RouteStation_ID,
      StopOrder: st.StopOrder,
      departureTime: null,
    }));
    try {
      setLoading(true);
      setError(null);
      await apiCall("/api/schedules/create", {
        method: "POST",
        body: JSON.stringify({
          Route_ID: selectedRoute.Route_ID,
          departureTimes,
        }),
      });
      await fetchSchedules(selectedRoute.Route_ID);
      setShowAddRow(false);
    } catch (e) {
      setError(`Failed to create ride: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateRide = async (rideId) => {
    const ride = schedules.find((r) => r.Ride_ID === rideId);
    if (!ride) return;
    const departureTimes = ride.stations.map((st) => ({
      RouteStation_ID: st.RouteStation_ID,
      StopOrder: st.StopOrder,
      departureTime: st.departureTime || null,
    }));
    try {
      setLoading(true);
      setError(null);
      await apiCall(`/api/schedules/update/${rideId}`, {
        method: "PUT",
        body: JSON.stringify({ departureTimes }),
      });
      await fetchSchedules(selectedRoute.Route_ID);
      setEditingRideId(null);
    } catch (e) {
      setError(`Failed to update ride: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteRide = async (rideId) => {
    try {
      setLoading(true);
      setError(null);
      await apiCall(`/api/schedules/delete/${rideId}`, { method: "DELETE" });
      await fetchSchedules(selectedRoute.Route_ID);
      setRideIdToDelete(null);
      setShowDeleteRow(false);
    } catch (e) {
      setError(`Failed to delete ride: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Editing helpers
  const startEditingRide = (rideId) => setEditingRideId(rideId);
  const saveRideChanges = async () => {
    if (editingRideId) await updateRide(editingRideId);
  };
  const cancelEditing = () => {
    setEditingRideId(null);
    if (selectedRoute?.Route_ID) fetchSchedules(selectedRoute.Route_ID);
  };

  // Implement button flow
  const onSave = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };
  const handleConfirmSave = async () => {
    if (editingRideId) await saveRideChanges();
    setShowConfirm(false);
  };
  const handleConfirmCancel = () => setShowConfirm(false);

  // ESC closes modals
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowConfirm(false);
        setShowAddChooser(false);
        setShowAddRow(false);
        setShowDeleteRow(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // PDF export (pre-format HTML in parent to avoid function injection problems)
  const exportToPDF = () => {
    if (!selectedRoute || !stations.length || !schedules.length) {
      setError("No data to export. Please select a route with schedules.");
      return;
    }

    const headerCells = stations
      .map((st) => `<th>${st.StationName}</th>`)
      .join("");

    const bodyRows = schedules
      .map((ride) => {
        const tds = ride.stations
          .map((st) => {
            const disp = st.departureTime
              ? formatTimeForDisplay(st.departureTime)
              : '<span class="empty-time">--:-- --</span>';
            return `<td>${disp}</td>`;
          })
          .join("");
        return `<tr><td class="ride-id">${ride.Ride_ID}</td>${tds}</tr>`;
      })
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ferry Schedule - ${selectedRoute.Route_name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #0b1a78; text-align: center; margin-bottom: 10px; }
    .route-info { text-align: center; margin-bottom: 20px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: center; }
    th { background-color: #0b1a78; color: #fff; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    tr:hover { background-color: #f5f5f5; }
    .ride-id { font-weight: bold; background-color: #e3f2fd !important; }
    .empty-time { color: #999; font-style: italic; }
    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>Ferry Schedule</h1>
  <div class="route-info">
    <strong>Route:</strong> ${selectedRoute.Route_name}<br/>
    <strong>Water Flow:</strong> ${selectedRoute.Water_flow}<br/>
    <strong>Generated:</strong> ${new Date().toLocaleString()}
  </div>
  <table>
    <thead>
      <tr><th>Ride ID</th>${headerCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <div class="footer">
    Ferry Schedule Management System<br/>This schedule is subject to change based on weather conditions and operational requirements.
  </div>
  <script>window.onload = () => { window.print(); setTimeout(()=>window.close(), 600); };</script>
</body>
</html>`.trim();

    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <div className="ops-sch-page">
        <div className="ops-sch-main">
          <h2 className="ops-sch-title">Schedules</h2>

          {error && (
            <div
              className="error-message"
              style={{
                color: "red",
                background: "#ffebee",
                padding: "10px",
                borderRadius: "4px",
                marginBottom: "16px",
              }}
            >
              {error}
              <button
                onClick={() => setError(null)}
                style={{
                  float: "right",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                aria-label="Close error"
              >
                ×
              </button>
            </div>
          )}

          {/* Top bar: Route selector (left) + actions (right) */}
          <div className="ops-sch-topbar">
            <label className="ops-sch-route" htmlFor="route-select">
              Route:
              <select
                id="route-select"
                value={selectedRoute?.Route_ID ?? ""}
                onChange={handleRouteChange}
                disabled={loading}
              >
                <option value="">Choose a route...</option>
                {routes.map((route) => (
                  <option key={route.Route_ID} value={route.Route_ID}>
                    {route.Route_name} ({route.Water_flow})
                  </option>
                ))}
              </select>
            </label>

            <div className="ops-sch-topbar-actions">
              <button
                type="button"
                className="ops-sch-chip"
                onClick={() => setShowAddChooser(true)}
                disabled={!selectedRoute || loading}
              >
                Add Ride
              </button>

              {editingRideId && (
                <>
                  <button
                    type="button"
                    className="ops-sch-edit is-on"
                    onClick={saveRideChanges}
                    disabled={loading}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="ops-sch-edit"
                    onClick={cancelEditing}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "20px" }}>Loading...</div>
          )}

          {selectedRoute && stations.length > 0 && (
            <div
              className="ops-sch-table-wrap"
              role="region"
              aria-label="Schedule Preview"
            >
              <table className="ops-sch-table">
                <thead>
                  <tr>
                    <th>Ride ID</th>
                    {stations.map((st) => (
                      <th key={st.RouteStation_ID}>{st.StationName}</th>
                    ))}
                    <th className="action-col">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((ride) => (
                    <tr key={ride.Ride_ID}>
                      <td style={{ fontWeight: "bold" }}>{ride.Ride_ID}</td>

                      {ride.stations.map((st) => (
                        <td key={st.RouteStation_ID}>
                          <input
                            className="sch-cell"
                            value={
                              editingRideId === ride.Ride_ID
                                ? st.departureTime || ""
                                : st.departureTime
                                ? formatTimeForDisplay(st.departureTime)
                                : ""
                            }
                            onChange={(e) => {
                              if (editingRideId === ride.Ride_ID) {
                                onCellChange(
                                  ride.Ride_ID,
                                  st.RouteStation_ID,
                                  e.target.value
                                );
                              }
                            }}
                            placeholder="--:-- --"
                            disabled={editingRideId !== ride.Ride_ID}
                            readOnly={editingRideId !== ride.Ride_ID}
                            tabIndex={editingRideId === ride.Ride_ID ? 0 : -1}
                          />
                        </td>
                      ))}

                      <td className="action-col">
                        {editingRideId === ride.Ride_ID ? (
                          <button
                            type="button"
                            className="icon-btn"
                            title="Save changes"
                            onClick={saveRideChanges}
                            disabled={loading}
                          >
                            ✓
                          </button>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                            }}
                          >
                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit ride"
                              onClick={() => startEditingRide(ride.Ride_ID)}
                              disabled={loading || editingRideId !== null}
                              style={{
                                backgroundImage:
                                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b1a78' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/%3E%3Cpath d='M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/%3E%3C/svg%3E\")",
                              }}
                            />
                            <button
                              type="button"
                              className="icon-btn"
                              title="Delete ride"
                              aria-label={`Delete ride ${ride.Ride_ID}`}
                              onClick={() => {
                                setRideIdToDelete(ride.Ride_ID);
                                setShowDeleteRow(true);
                              }}
                              disabled={loading || editingRideId !== null}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedRoute && stations.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
              No stations found for this route.
            </div>
          )}

          {!selectedRoute && (
            <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
              Please select a route to view schedules.
            </div>
          )}

          {/* Bottom actions */}
          <div className="ops-sch-actions">
            <button
              className="ops-sch-secondary"
              type="button"
              onClick={exportToPDF}
              disabled={!selectedRoute || loading}
            >
              Save as PDF
            </button>
            <button
              className="ops-sch-primary"
              type="button"
              onClick={onSave}
              disabled={!editingRideId || loading}
            >
              Implement
            </button>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={handleConfirmCancel}
        >
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 id="confirm-title">Save Changes</h3>
            <p>Are you sure you want to save these schedule changes?</p>
            <div className="confirm-buttons">
              <button
                className="cancel-btn"
                type="button"
                onClick={handleConfirmCancel}
                autoFocus
              >
                Cancel
              </button>
              <button
                className="yes-btn"
                type="button"
                onClick={handleConfirmSave}
                disabled={loading}
              >
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add chooser modal */}
      {showAddChooser && (
        <div
          className="addch-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-chooser-title"
          onClick={() => setShowAddChooser(false)}
        >
          <div className="addch-box" onClick={(e) => e.stopPropagation()}>
            <h3 id="add-chooser-title" className="addch-title">
              Add New Ride
            </h3>
            <p>
              This will create a new ride with empty time slots for all stations
              on the selected route.
            </p>
            <div className="addch-actions">
              <button
                className="addch-btn outline"
                type="button"
                onClick={() => setShowAddChooser(false)}
              >
                Cancel
              </button>
              <button
                className="addch-btn"
                type="button"
                onClick={() => {
                  setShowAddChooser(false);
                  setShowAddRow(true);
                }}
              >
                Add Ride
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add ride modal */}
      {showAddRow && (
        <div
          className="rt-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-row-title"
          onClick={() => setShowAddRow(false)}
        >
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 id="add-row-title" className="rt-modalTitle">
                Add New Ride
              </h3>
              <button
                className="rt-close"
                onClick={() => setShowAddRow(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="rt-modalBody">
              <p>
                This will create a new ride for route:{" "}
                <strong>{selectedRoute?.Route_name}</strong>
              </p>
              <p>
                The ride will include all {stations.length} stations with empty
                time slots that you can edit.
              </p>
            </div>
            <div className="rt-modalActions">
              <button
                className="rt-btn rt-btnOutline"
                onClick={() => setShowAddRow(false)}
              >
                Cancel
              </button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={createRide}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Ride"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete ride modal */}
      {showDeleteRow && rideIdToDelete && (
        <div
          className="rt-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-row-title"
          onClick={() => setShowDeleteRow(false)}
        >
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 id="delete-row-title" className="rt-modalTitle">
                Delete Ride
              </h3>
              <button
                className="rt-close"
                onClick={() => setShowDeleteRow(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="rt-modalBody">
              <p>
                Are you sure you want to delete ride{" "}
                <strong>{rideIdToDelete}</strong>?
              </p>
              <p>This will permanently remove all schedule entries.</p>
            </div>
            <div className="rt-modalActions">
              <button
                className="rt-btn rt-btnOutline"
                onClick={() => setShowDeleteRow(false)}
              >
                Cancel
              </button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={() => deleteRide(rideIdToDelete)}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Delete Ride"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
