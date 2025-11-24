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
  const [vehicles, setVehicles] = useState([]);

  // Loading flags
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingStations, setLoadingStations] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingSuspend, setLoadingSuspend] = useState(false);

  // UI state
  const [editingRideId, setEditingRideId] = useState(null);
  const [error, setError] = useState(null);

  // Modals
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [showDeleteRow, setShowDeleteRow] = useState(false);
  const [rideIdToDelete, setRideIdToDelete] = useState(null);

  // Assign Vehicle modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignRideId, setAssignRideId] = useState("");
  const [assignVehicleId, setAssignVehicleId] = useState("");

  // Suspend modal
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

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
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      try {
        return await resp.json();
      } catch {
        return null;
      }
    },
    [apiUrl]
  );

  // =========================
  // Fetch helpers
  // =========================

  const fetchRoutes = useCallback(
    async (silentUpdate = false) => {
      if (!apiUrl) return;
      try {
        if (!silentUpdate) {
          setLoadingRoutes(true);
        }
        setError(null);
        const data = await apiCall("/api/schedules/routes");
        const arr = Array.isArray(data) ? data : [];
        setRoutes(arr);

        if (arr.length) {
          if (selectedRoute) {
            const match = arr.find(
              (r) => String(r.Route_ID) === String(selectedRoute.Route_ID)
            );
            setSelectedRoute(match || arr[0]);
          } else {
            setSelectedRoute(arr[0]);
          }
        } else {
          setSelectedRoute(null);
        }
      } catch (e) {
        setError(`Failed to fetch routes: ${e.message}`);
      } finally {
        if (!silentUpdate) {
          setLoadingRoutes(false);
        }
      }
    },
    [apiCall, apiUrl, selectedRoute]
  );

  const fetchStations = useCallback(
    async (routeId) => {
      if (!routeId) return;
      try {
        setLoadingStations(true);
        setError(null);
        const data = await apiCall(
          `/api/schedules/stations?Route_ID=${encodeURIComponent(routeId)}`
        );
        setStations(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(`Failed to fetch stations: ${e.message}`);
      } finally {
        setLoadingStations(false);
      }
    },
    [apiCall]
  );

  const fetchSchedules = useCallback(
    async (routeId) => {
      if (!routeId) return;
      try {
        setLoadingSchedules(true);
        setError(null);
        const data = await apiCall(
          `/api/schedules/by-route?Route_ID=${encodeURIComponent(routeId)}`
        );
        setSchedules(
          Array.isArray(data)
            ? data.map((r) => ({
                ...r,
                Vehicle_ID: r.Vehicle_ID || "",
              }))
            : []
        );
      } catch (e) {
        setError(`Failed to fetch schedules: ${e.message}`);
      } finally {
        setLoadingSchedules(false);
      }
    },
    [apiCall]
  );

  const fetchVehicles = useCallback(async () => {
    try {
      const data = await apiCall("/api/schedules/vehicles");
      setVehicles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch vehicles:", e.message);
    }
  }, [apiCall]);

  useEffect(() => {
    fetchRoutes();
    fetchVehicles();
  }, [fetchRoutes, fetchVehicles]);

  useEffect(() => {
    if (selectedRoute?.Route_ID) {
      fetchStations(selectedRoute.Route_ID);
      fetchSchedules(selectedRoute.Route_ID);
    } else {
      setStations([]);
      setSchedules([]);
    }
  }, [selectedRoute, fetchStations, fetchSchedules]);

  const isDataLoading =
    loadingRoutes || loadingStations || loadingSchedules || false;
  const isRouteSuspended =
    selectedRoute && Number(selectedRoute.is_active) === 0;

  // =========================
  // Helpers & handlers
  // =========================

  const formatTimeForDisplay = (timeStr) => {
    if (!timeStr) return "";
    try {
      const [hStr, mStrRaw] = timeStr.split(":");
      let h = parseInt(hStr, 10);
      const m = (mStrRaw || "00").padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      return `${h}:${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

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
      setLoadingAction(true);
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
      setLoadingAction(false);
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
      setLoadingAction(true);
      setError(null);

      await apiCall(`/api/schedules/update/${rideId}`, {
        method: "PUT",
        body: JSON.stringify({
          departureTimes,
          Vehicle_ID: ride.Vehicle_ID || null,
        }),
      });

      await fetchSchedules(selectedRoute.Route_ID);
      setEditingRideId(null);
    } catch (e) {
      setError(`Failed to update ride: ${e.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const deleteRide = async (rideId) => {
    try {
      setLoadingAction(true);
      setError(null);
      await apiCall(`/api/schedules/delete/${rideId}`, {
        method: "DELETE",
      });
      await fetchSchedules(selectedRoute.Route_ID);
      setRideIdToDelete(null);
      setShowDeleteRow(false);
    } catch (e) {
      setError(`Failed to delete ride: ${e.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const startEditingRide = (rideId) => setEditingRideId(rideId);

  // Save handler can be called with explicit ride ID (from row)
  const saveRideChanges = async (rideIdOverride) => {
    const idToSave = rideIdOverride || editingRideId;
    if (idToSave) await updateRide(idToSave);
  };

  const cancelEditing = () => {
    setEditingRideId(null);
    if (selectedRoute?.Route_ID) fetchSchedules(selectedRoute.Route_ID);
  };

  // ESC to close modals
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowAddChooser(false);
        setShowAddRow(false);
        setShowDeleteRow(false);
        setShowAssignModal(false);
        setShowSuspendModal(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
<title>Schedule - ${selectedRoute.Route_name}</title>
<style>
body { font-family: Arial, sans-serif; padding: 20px; }
h1 { text-align: center; margin-bottom: 20px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #000; padding: 8px; text-align: center; }
th { background: #eee; }
.ride-id { font-weight: bold; }
.empty-time { color: #aaa; }
</style>
</head>
<body>
<h1>Schedule for Route: ${selectedRoute.Route_name}</h1>
<table>
  <thead>
    <tr>
      <th>Ride ID</th>
      ${headerCells}
    </tr>
  </thead>
  <tbody>
    ${bodyRows}
  </tbody>
</table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  };

  // Suspend / Resume route

  const openSuspendModal = () => {
    setSuspendReason("");
    setShowSuspendModal(true);
  };

  const confirmSuspend = async () => {
    if (!selectedRoute?.Route_ID) return;
    if (!suspendReason.trim()) {
      setError("Please provide a reason for suspension.");
      return;
    }

    const routeId = selectedRoute.Route_ID;
    try {
      setLoadingSuspend(true);
      setError(null);

      await apiCall("/api/schedules/suspend-route", {
        method: "POST",
        body: JSON.stringify({
          Route_ID: routeId,
          Reason: suspendReason.trim(),
        }),
      });

      await fetchRoutes();
      await fetchSchedules(routeId);

      setShowSuspendModal(false);
      setSuspendReason("");
    } catch (e) {
      setError(`Failed to suspend route: ${e.message}`);
    } finally {
      setLoadingSuspend(false);
    }
  };

  const resumeRoute = async () => {
    if (!selectedRoute?.Route_ID) return;
    const routeId = selectedRoute.Route_ID;

    try {
      setLoadingSuspend(true);
      setError(null);

      await apiCall("/api/schedules/resume-route", {
        method: "POST",
        body: JSON.stringify({
          Route_ID: routeId,
        }),
      });

      await fetchRoutes();
      await fetchSchedules(routeId);
    } catch (e) {
      setError(`Failed to resume route: ${e.message}`);
    } finally {
      setLoadingSuspend(false);
    }
  };

  // Assign vehicle to ride
  const saveVehicleAssignment = async () => {
    if (!assignRideId || !assignVehicleId) return;

    try {
      setLoadingAction(true);
      setError(null);

      await apiCall("/api/schedules/assign-vehicle", {
        method: "PUT",
        body: JSON.stringify({
          Ride_ID: assignRideId,
          Vehicle_ID: assignVehicleId,
        }),
      });

      if (selectedRoute?.Route_ID) {
        await fetchSchedules(selectedRoute.Route_ID);
      }

      setAssignRideId("");
      setAssignVehicleId("");
      setShowAssignModal(false);
    } catch (e) {
      setError(`Failed to assign vehicle: ${e.message}`);
    } finally {
      setLoadingAction(false);
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
            <div className="error-message" style={{ color: "red" }}>
              {error}
              <button
                onClick={() => setError(null)}
                style={{ float: "right" }}
                aria-label="Close error"
              >
                ×
              </button>
            </div>
          )}

          {isRouteSuspended && selectedRoute && (
            <div className="ops-sch-banner warning">
              ⚠ Operations Suspended for{" "}
              <strong>{selectedRoute.Route_name}</strong>. All schedules are
              currently disabled.
            </div>
          )}

          {/* Top bar */}
          <div className="ops-sch-topbar">
            <label className="ops-sch-route" htmlFor="route-select">
              Route:
              <select
                id="route-select"
                value={selectedRoute?.Route_ID ?? ""}
                onChange={handleRouteChange}
              >
                <option value="">Choose a route...</option>
                {routes.map((route) => (
                  <option key={route.Route_ID} value={route.Route_ID}>
                    {route.Route_name}
                  </option>
                ))}
              </select>
            </label>

            <div className="ops-sch-topbar-actions">
              <button
                type="button"
                className="ops-sch-chip danger"
                onClick={openSuspendModal}
                disabled={
                  !selectedRoute ||
                  isRouteSuspended ||
                  !schedules.length ||
                  loadingSuspend
                }
              >
                {loadingSuspend && !isRouteSuspended
                  ? "Disabling..."
                  : "Disable All Schedules"}
              </button>

              <button
                type="button"
                className="ops-sch-chip"
                onClick={resumeRoute}
                disabled={!selectedRoute || !isRouteSuspended || loadingSuspend}
              >
                {loadingSuspend && isRouteSuspended
                  ? "Resuming..."
                  : "Resume Operations"}
              </button>

              <button
                type="button"
                className="ops-sch-chip"
                style={{ width: "320px" }}
                disabled={
                  !selectedRoute ||
                  !schedules.length ||
                  isRouteSuspended ||
                  loadingAction
                }
                onClick={() => setShowAssignModal(true)}
              >
                Assign a Vehicle to a Ride
              </button>

              <button
                type="button"
                className="ops-sch-chip"
                onClick={() => setShowAddChooser(true)}
                disabled={!selectedRoute || isRouteSuspended || loadingAction}
              >
                Add Ride
              </button>
              {/* No Save/Cancel here; Save/Cancel is per-row in the table */}
            </div>
          </div>

          {selectedRoute && stations.length > 0 && (
            <div className="ops-sch-table-wrap">
              <table className="ops-sch-table">
                <thead>
                  <tr>
                    <th>Ride ID</th>
                    <th>Vehicle ID</th>
                    {stations.map((st) => (
                      <th key={st.RouteStation_ID}>{st.StationName}</th>
                    ))}
                    <th className="action-col">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((ride) => (
                    <tr
                      key={ride.Ride_ID}
                      className={
                        isRouteSuspended || Number(ride.is_active) === 0
                          ? "row-disabled"
                          : ""
                      }
                    >
                      <td style={{ fontWeight: "bold" }}>{ride.Ride_ID}</td>

                      {/* Vehicle ID cell */}
                      <td>
                        {editingRideId === ride.Ride_ID && !isRouteSuspended ? (
                          <input
                            className="sch-cell"
                            value={ride.Vehicle_ID || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSchedules((prev) =>
                                prev.map((r) =>
                                  r.Ride_ID === ride.Ride_ID
                                    ? { ...r, Vehicle_ID: val }
                                    : r
                                )
                              );
                            }}
                            placeholder="--"
                          />
                        ) : (
                          <span>{ride.Vehicle_ID || "--"}</span>
                        )}
                      </td>

                      {ride.stations.map((st) => (
                        <td key={st.RouteStation_ID}>
                          <input
                            className="sch-cell"
                            value={
                              editingRideId === ride.Ride_ID &&
                              !isRouteSuspended
                                ? st.departureTime || ""
                                : st.departureTime
                                ? formatTimeForDisplay(st.departureTime)
                                : ""
                            }
                            onChange={(e) => {
                              if (
                                editingRideId === ride.Ride_ID &&
                                !isRouteSuspended
                              ) {
                                onCellChange(
                                  ride.Ride_ID,
                                  st.RouteStation_ID,
                                  e.target.value
                                );
                              }
                            }}
                            placeholder="--:-- --"
                            disabled={
                              editingRideId !== ride.Ride_ID || isRouteSuspended
                            }
                            readOnly={
                              editingRideId !== ride.Ride_ID || isRouteSuspended
                            }
                          />
                        </td>
                      ))}

                      <td className="action-col">
                        {editingRideId === ride.Ride_ID && !isRouteSuspended ? (
                          <div className="row-actions">
                            <button
                              type="button"
                              className="row-save-btn"
                              onClick={() => saveRideChanges(ride.Ride_ID)}
                              disabled={loadingAction}
                            >
                              {loadingAction ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="row-cancel-btn"
                              onClick={cancelEditing}
                              disabled={loadingAction}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit ride"
                              onClick={() => startEditingRide(ride.Ride_ID)}
                              disabled={
                                editingRideId !== null || isRouteSuspended
                              }
                              style={{
                                backgroundImage:
                                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b1a78' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/%3E%3Cpath d='M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/%3E%3C/svg%3E\")",
                              }}
                            />
                              <button
                              type="button"
                              className="icon-btn"
                              title="Delete ride"
                              onClick={() => {
                                setRideIdToDelete(ride.Ride_ID);
                                setShowDeleteRow(true);
                              }}
                              disabled={
                                editingRideId !== null || isRouteSuspended
                              }
                              style={{
                                backgroundImage:
                                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23b91c1c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='3 6 5 6 21 6'/%3E%3Cpath d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'/%3E%3Cpath d='M10 11v6M14 11v6'/%3E%3Cpath d='M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'/%3E%3C/svg%3E\")",
                              }}
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

          {selectedRoute && stations.length === 0 && !isDataLoading && (
            <div style={{ textAlign: "center" }}>No stations found.</div>
          )}

          {!selectedRoute && (
            <div style={{ textAlign: "center" }}>Please select a route.</div>
          )}

          <div className="ops-sch-actions">
            <button
              className="ops-sch-secondary"
              type="button"
              onClick={exportToPDF}
              disabled={!selectedRoute || !schedules.length}
            >
              Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* Add chooser */}
      {showAddChooser && (
        <div className="addch-overlay" onClick={() => setShowAddChooser(false)}>
          <div className="addch-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="addch-title">Add New Ride</h3>
            <p>This will create a new ride.</p>
            <div className="addch-actions">
              <button
                className="addch-btn outline"
                onClick={() => setShowAddChooser(false)}
              >
                Cancel
              </button>
              <button
                className="addch-btn"
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

      {/* Add ride */}
      {showAddRow && (
        <div className="rt-modalOverlay" onClick={() => setShowAddRow(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Add New Ride</h3>
              <button className="rt-close" onClick={() => setShowAddRow(false)}>
                ×
              </button>
            </div>
            <div className="rt-modalBody">
              <p>
                This will create a new ride for route:{" "}
                <strong>{selectedRoute?.Route_name}</strong>
              </p>
            </div>
            <div className="rt-modalActions">
              <button
                className="rt-btn rt-btnOutline"
                onClick={() => setShowAddRow(false)}
                disabled={loadingAction}
              >
                Cancel
              </button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={createRide}
                disabled={loadingAction}
              >
                {loadingAction ? "Creating..." : "Create Ride"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete ride */}
      {showDeleteRow && rideIdToDelete && (
        <div
          className="rt-modalOverlay"
          onClick={() => setShowDeleteRow(false)}
        >
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Delete Ride</h3>
              <button
                className="rt-close"
                onClick={() => setShowDeleteRow(false)}
              >
                ×
              </button>
            </div>
            <div className="rt-modalBody">
              <p>
                Are you sure you want to delete ride{" "}
                <strong>{rideIdToDelete}</strong>?
              </p>
            </div>
            <div className="rt-modalActions">
              <button
                className="rt-btn rt-btnOutline"
                onClick={() => setShowDeleteRow(false)}
                disabled={loadingAction}
              >
                Cancel
              </button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={() => deleteRide(rideIdToDelete)}
                disabled={loadingAction}
              >
                {loadingAction ? "Deleting..." : "Delete Ride"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Vehicle Modal */}
      {showAssignModal && (
        <div
          className="rt-modalOverlay"
          onClick={() => setShowAssignModal(false)}
        >
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Assign a Vehicle to a Ride</h3>
              <button
                className="rt-close"
                onClick={() => setShowAssignModal(false)}
              >
                ×
              </button>
            </div>

            <div className="rt-modalBody">
              <div className="assign-row">
                <label>
                  <strong>Ride ID</strong>
                </label>
                <select
                  className="rt-input"
                  value={assignRideId}
                  onChange={(e) => setAssignRideId(e.target.value)}
                >
                  <option value="">Select Ride</option>
                  {schedules.map((r) => (
                    <option key={r.Ride_ID} value={r.Ride_ID}>
                      {r.Ride_ID}
                    </option>
                  ))}
                </select>
              </div>

              <div className="assign-row">
                <label>
                  <strong>Vehicle</strong>
                </label>
                <select
                  className="rt-input"
                  value={assignVehicleId}
                  onChange={(e) => setAssignVehicleId(e.target.value)}
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.Vehicle_ID} value={v.Vehicle_ID}>
                      {v.Vehicle_ID} ({v.vehicleType})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rt-modalActions">
              <button
                className="rt-btn rt-btnOutline"
                onClick={() => setShowAssignModal(false)}
                disabled={loadingAction}
              >
                Cancel
              </button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={saveVehicleAssignment}
                disabled={!assignRideId || !assignVehicleId || loadingAction}
              >
                {loadingAction ? "Assigning..." : "Save Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Route Modal */}
      {showSuspendModal && (
        <div
          className="rt-modalOverlay"
          onClick={() => setShowSuspendModal(false)}
        >
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Disable All Schedules</h3>
              <button
                className="rt-close"
                onClick={() => setShowSuspendModal(false)}
              >
                ×
              </button>
            </div>

            <div className="rt-modalBody">
              <p>
                You are about to disable all schedules for route:{" "}
                <strong>{selectedRoute?.Route_name}</strong>.
              </p>
              <p>Please provide the reason for this suspension:</p>
              <textarea
                className="rt-textarea"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Example: Typhoon Signal #2 (PAGASA advisory), mechanical failure, port closure, etc."
              />
            </div>

            <div className="rt-modalActions">
              <button
                className="rt-btn rt-btnOutline"
                onClick={() => setShowSuspendModal(false)}
                disabled={loadingSuspend}
              >
                Cancel
              </button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={confirmSuspend}
                disabled={loadingSuspend || !suspendReason.trim()}
              >
                {loadingSuspend ? "Disabling..." : "Confirm Disable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
