import { useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_faresTab.css";

const apiUrl = import.meta.env.VITE_API_URL;

export default function FareTab() {
  const [stations, setStations] = useState([]);
  const [fareMatrix, setFareMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingStations, setEditingStations] = useState([]);
  const [viewMode, setViewMode] = useState("fare");
  const [fareStats, setFareStats] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});

  const getAuthToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const showMessage = (message, type = "success") => {
    if (type === "success") {
      setSuccess(message);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(message);
      setSuccess(null);
      setTimeout(() => setError(null), 5000);
    }
  };

  const syncStations = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/fare/stations/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to sync stations");
      }
      const data = await res.json();
      showMessage(data.message);
      await fetchStations();
    } catch (err) {
      showMessage("Error syncing stations: " + err.message, "error");
    }
  };

  const fetchStations = async () => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error("No authentication token found");

      const res = await fetch(`${apiUrl}/api/fare/stations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Authentication failed.");
        throw new Error("Failed to fetch stations");
      }
      const data = await res.json();

      if (data.stations) {
        setStations(data.stations);
        setEditingStations([...data.stations]);
        if (data.stations.length === 0 && data.debug_info) {
          if (data.debug_info.main_station_count > 0) {
            showMessage(
              `Found ${data.debug_info.main_station_count} stations in main table but Station_Master is empty. Click 'Sync Stations' to populate it.`,
              "error"
            );
          } else {
            showMessage("No stations found. Please add stations first.", "error");
          }
        }
      } else {
        setStations(data);
        setEditingStations([...data]);
      }
    } catch (err) {
      showMessage("Error fetching stations: " + err.message, "error");
      console.error(err);
    }
  };

  const fetchFareMatrix = async () => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error("No authentication token found");

      const res = await fetch(`${apiUrl}/api/fare/matrix`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Authentication failed.");
        throw new Error("Failed to fetch fare matrix");
      }
      const data = await res.json();
      setFareMatrix(data);
    } catch (err) {
      showMessage("Error fetching fare matrix: " + err.message, "error");
      console.error(err);
    }
  };

  const fetchFareStats = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/fare/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setFareStats(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStations(), fetchFareMatrix(), fetchFareStats()]);
      setLoading(false);
    };
    init();
  }, []);

  const handleStationOrderUpdate = (stationId, newOrder) => {
    const n = parseInt(newOrder, 10);
    if (Number.isNaN(n) || n < 1) return;
    setEditingStations((prev) =>
      prev
        .map((s) => (s.Station_ID === stationId ? { ...s, StopOrder: n } : s))
        .sort((a, b) => a.StopOrder - b.StopOrder)
    );
  };

  const saveStationOrder = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/fare/stations/order`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stations: editingStations }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update station order");
      }
      showMessage("Station order updated successfully");
      setStations([...editingStations]);
      await regenerateFareMatrix();
      setViewMode("fare");
    } catch (err) {
      showMessage("Error updating station order: " + err.message, "error");
    }
  };

  const regenerateFareMatrix = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/fare/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to regenerate fare matrix");
      }
      const result = await res.json();
      showMessage(
        `${result.message}. Created ${result.new_fares_created} new fare entries.`
      );
      await Promise.all([fetchFareMatrix(), fetchFareStats()]);
    } catch (err) {
      showMessage("Error regenerating fare matrix: " + err.message, "error");
    }
  };

  const handleFareChange = (fareId, newFare) => {
    setFareMatrix((prev) =>
      prev.map((f) =>
        f.Fare_ID === fareId ? { ...f, Fare: parseFloat(newFare) || 0 } : f
      )
    );
    setPendingChanges((prev) => ({
      ...prev,
      [fareId]: { Fare: parseFloat(newFare) || 0 },
    }));
  };

  const saveFare = async (fareId, fareValue, isActive = null) => {
    try {
      const token = getAuthToken();
      const payload = { Fare: parseFloat(fareValue) || 0 };
      if (isActive !== null) payload.Active = isActive;

      const res = await fetch(`${apiUrl}/api/fare/update/${fareId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update fare");
      }
      setPendingChanges((prev) => {
        const copy = { ...prev };
        delete copy[fareId];
        return copy;
      });
      showMessage("Fare updated successfully");
      await fetchFareStats();
    } catch (err) {
      showMessage("Error updating fare: " + err.message, "error");
      await fetchFareMatrix();
    }
  };

  const toggleFareStatus = async (fareId, currentStatus) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/fare/update/${fareId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ Active: !currentStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update fare status");
      }
      setFareMatrix((prev) =>
        prev.map((f) =>
          f.Fare_ID === fareId ? { ...f, Active: !currentStatus } : f
        )
      );
      showMessage(`Fare ${!currentStatus ? "enabled" : "disabled"} successfully`);
      await fetchFareStats();
    } catch (err) {
      showMessage("Error updating fare status: " + err.message, "error");
    }
  };

  const bulkToggleAllFares = async (enableAll = true) => {
    try {
      const token = getAuthToken();
      const activeFares = fareMatrix.filter((f) => f.Fare_ID !== null);
      if (!activeFares.length) {
        showMessage("No fares to update", "error");
        return;
      }
      const res = await fetch(`${apiUrl}/api/fare/update/bulk`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fares: activeFares.map((f) => ({
            Fare_ID: f.Fare_ID,
            Active: enableAll,
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to bulk update fares");
      }
      setFareMatrix((prev) =>
        prev.map((f) => (f.Fare_ID ? { ...f, Active: enableAll } : f))
      );
      showMessage(
        `Successfully ${enableAll ? "enabled" : "disabled"} ${activeFares.length} fares`
      );
      await fetchFareStats();
    } catch (err) {
      showMessage(
        `Error ${enableAll ? "enabling" : "disabling"} all fares: ` + err.message,
        "error"
      );
    }
  };

  const saveAllPendingChanges = async () => {
    const keys = Object.keys(pendingChanges);
    if (!keys.length) {
      showMessage("No changes to save", "error");
      return;
    }
    const payload = keys.map((id) => ({
      Fare_ID: parseInt(id, 10),
      ...pendingChanges[id],
    }));
    try {
      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/fare/update/bulk`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fares: payload }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save changes");
      }
      setPendingChanges({});
      showMessage(`Successfully saved ${payload.length} fare changes`);
      await fetchFareStats();
    } catch (err) {
      showMessage("Error saving changes: " + err.message, "error");
    }
  };

  const createFareMatrixDisplay = () => {
    if (!stations.length || !fareMatrix.length) return { matrix: [], activeStations: [] };

    const activeStations = stations.filter((s) => s.Active);
    const matrix = [];

    activeStations.forEach((from) => {
      const row = [];
      activeStations.forEach((to) => {
        if (from.Station_ID === to.Station_ID) {
          row.push({ fare: 0, isDisabled: true, fareId: null, active: false });
        } else {
          const entry = fareMatrix.find(
            (f) =>
              f.From_Station_ID === from.Station_ID &&
              f.To_Station_ID === to.Station_ID
          );
          row.push({
            fare: entry ? entry.Fare : 0,
            fareId: entry ? entry.Fare_ID : null,
            active: entry ? entry.Active : false,
            isDisabled: false,
            fromName: from.StationName,
            toName: to.StationName,
          });
        }
      });
      matrix.push(row);
    });

    return { matrix, activeStations };
  };

  const { matrix: fareDisplayMatrix, activeStations } = createFareMatrixDisplay();

  if (loading) {
    return (
      <>
        <Navbar />
        <HeaderButton />
        <OperationsTab />
        <div className="fare-tab-page">
          <div className="fare-tab-main">
            <div className="ops-page-title">Fare</div>
            <div className="loading-container">Loading fare data...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <div className="fare-tab-page">
        <div className="fare-tab-main">
          <div className="ops-page-title">Fare Management</div>

          {error && <div className="message-box error-message">{error}</div>}
          {success && <div className="message-box success-message">{success}</div>}

          {fareStats && (
            <div className="stats-container">
              <h4>System Overview</h4>
              <div className="stats-grid">
                <div><strong>Stations:</strong> {fareStats.total_stations}</div>
                <div><strong>Active Routes:</strong> {fareStats.total_fares}</div>
                <div><strong>Unset Fares:</strong> {fareStats.unset_fares}</div>
              </div>
            </div>
          )}

          {/* Top pills and actions */}
          <div className="fare-topbar">
            <div className="fare-tabs">
              <button
                className={`fare-pill ${viewMode === "fare" ? "active" : ""}`}
                onClick={() => setViewMode("fare")}
              >
                Fare Matrix
              </button>
              <button
                className={`fare-pill ${viewMode === "stationMaster" ? "active" : ""}`}
                onClick={() => {
                  setViewMode("stationMaster");
                  setEditingStations([...stations]);
                }}
              >
                Station Master
              </button>
            </div>

            <div className="fare-actions">
              {Object.keys(pendingChanges).length > 0 && (
                <button className="btn navy" onClick={saveAllPendingChanges}>
                  Save All Changes ({Object.keys(pendingChanges).length})
                </button>
              )}
              {stations.length === 0 && (
                <button className="btn outline" onClick={syncStations}>
                  Sync Stations
                </button>
              )}
            </div>
          </div>

          {/* Station Master */}
          {viewMode === "stationMaster" && (
            <div className="card section">
              <div className="section-head">
                <h3>Station Order Management</h3>
                <div className="section-actions">
                  <button className="btn outline" onClick={syncStations}>Sync</button>
                  <button className="btn navy" onClick={saveStationOrder}>Save</button>
                </div>
              </div>
              <p className="description">
                Set the order of stations for the fare matrix generation. Lower numbers appear first.
              </p>

              {editingStations.length > 0 ? (
                <div className="table-shell">
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>Station Name</th>
                          <th>Order</th>
                          <th>Status</th>
                          <th>Station ID</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editingStations
                          .sort((a, b) => a.StopOrder - b.StopOrder)
                          .map((station) => (
                            <tr key={station.Station_ID}>
                              <td className="left">{station.StationName}</td>
                              <td className="center">
                                <input
                                  className="order-input"
                                  type="number"
                                  min="1"
                                  value={station.StopOrder}
                                  onChange={(e) =>
                                    handleStationOrderUpdate(
                                      station.Station_ID,
                                      e.target.value
                                    )
                                  }
                                />
                              </td>
                              <td className="center">
                                <span
                                  className={`badge ${station.Active ? "ok" : "bad"}`}
                                >
                                  {station.Active ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="mono center">{station.Station_ID}</td>
                              <td className="center">
                                <button
                                  className="btn navy sm"
                                  onClick={saveStationOrder}
                                >
                                  Save
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <h4>No stations found in Station_Master table</h4>
                  <p>You need to sync stations from your main Station table first.</p>
                  <button className="btn navy" onClick={syncStations}>
                    Sync Stations from Main Table
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Fare Matrix */}
          {viewMode === "fare" && (
            <div className="card section">
              <div className="section-head">
                <h3>Fare Matrix</h3>
                <div className="section-actions">
                  <button className="btn navy" onClick={regenerateFareMatrix}>
                    Regenerate Matrix
                  </button>
                  <button
                    className="btn green"
                    onClick={() => bulkToggleAllFares(true)}
                    disabled={fareMatrix.length === 0}
                  >
                    Enable All
                  </button>
                  <button
                    className="btn red"
                    onClick={() => bulkToggleAllFares(false)}
                    disabled={fareMatrix.length === 0}
                  >
                    Disable All
                  </button>
                </div>
              </div>

              {activeStations.length > 0 && fareDisplayMatrix.length > 0 ? (
                <div className="matrix-shell">
                  <div className="matrix-scroll">
                    <table className="matrix-table">
                      <thead>
                        <tr>
                          <th className="corner">FROM / TO</th>
                          {activeStations.map((s) => (
                            <th key={s.Station_ID} className="col-head">
                              <span className="col-head-text">{s.StationName}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fareDisplayMatrix.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td className="row-head">
                              <span className="row-head-text">
                                {activeStations[rIdx]?.StationName}
                              </span>
                            </td>
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={[
                                  "cell",
                                  cell.isDisabled
                                    ? "disabled"
                                    : !cell.active
                                    ? "inactive"
                                    : pendingChanges[cell.fareId]
                                    ? "pending"
                                    : "active",
                                ].join(" ")}
                              >
                                {cell.isDisabled ? (
                                  <div className="dash">—</div>
                                ) : (
                                  <div className="cell-inner">
                                    <input
                                      className="fare-input"
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={cell.fare}
                                      onChange={(e) =>
                                        cell.fareId &&
                                        handleFareChange(cell.fareId, e.target.value)
                                      }
                                      onBlur={(e) =>
                                        cell.fareId &&
                                        saveFare(cell.fareId, e.target.value)
                                      }
                                      disabled={!cell.fareId}
                                      placeholder="0.00"
                                    />
                                    {cell.fareId && (
                                      <button
                                        className={`status ${cell.active ? "on" : "off"}`}
                                        onClick={() =>
                                          toggleFareStatus(cell.fareId, cell.active)
                                        }
                                      >
                                        {cell.active ? "Active" : "Disabled"}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No fare data available. Please ensure stations are configured and regenerate the matrix.</p>
                  <button className="btn navy" onClick={regenerateFareMatrix}>
                    Generate Fare Matrix
                  </button>
                </div>
              )}

              <div className="instructions">
                <p><strong>Instructions:</strong></p>
                <ul>
                  <li>Edit fares directly in the cells — values save on blur</li>
                  <li>Use the status chip to enable/disable a route pair</li>
                  <li>Yellow rows indicate unsaved changes</li>
                  <li>Use Station Master to reorder stations before regenerating</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
