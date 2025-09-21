import { useCallback, useEffect, useMemo, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_routesTab.css";

const apiUrl = import.meta.env.VITE_API_URL;
console.log("API URL from env:", apiUrl);

export function RoutesTab() {
  const [rows, setRows] = useState([]);
  const [stationRows, setStationRows] = useState([]);
  const [availableStations, setAvailableStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [routeQuery, setRouteQuery] = useState("");
  const [stationQuery, setStationQuery] = useState("");
  const [route, setRoute] = useState("");
  const [waterFlowFilter, setWaterFlowFilter] = useState("All");

  /* ===== ROUTE modals/state ===== */
  const [routeAddOpen, setRouteAddOpen] = useState(false);
  const [routeEditOpen, setRouteEditOpen] = useState(false);
  const [routeConfirm, setRouteConfirm] = useState({ kind: null, open: false });
  const [routeDraft, setRouteDraft] = useState({
    routeId: "",
    companyId: "",
    routeName: "",
    waterFlow: "DS",
    direction: "FW",
  });
  const [routeEdit, setRouteEdit] = useState({
    routeId: "",
    companyId: "",
    routeName: "",
    waterFlow: "DS",
    direction: "FW",
  });
  const [routeToDelete, setRouteToDelete] = useState(null);

  /* ===== STATION modals/state ===== */
  const [stAddOpen, setStAddOpen] = useState(false);
  const [stEditOpen, setStEditOpen] = useState(false);
  const [stConfirm, setStConfirm] = useState({ kind: null, open: false });
  const [stDraft, setStDraft] = useState({
    routeStationId: "",
    routeId: "",
    stationId: "",
    stationName: "",
    stopOrder: 1,
  });
  const [stEdit, setStEdit] = useState({
    routeStationId: "",
    routeId: "",
    stationId: "",
    stationName: "",
    stopOrder: 1,
  });
  const [stToDelete, setStToDelete] = useState(null);

  /* ===== Derived helpers ===== */
  const filteredRoutes = useMemo(() => {
    let filtered = rows;
    
    // Apply water flow filter first
    if (waterFlowFilter !== "All") {
      if (waterFlowFilter === "Upstream") {
        filtered = filtered.filter(r => r.waterFlow === 'US');
      } else if (waterFlowFilter === "Downstream") {
        filtered = filtered.filter(r => r.waterFlow === 'DS');
      } else if (waterFlowFilter === "N/A") {
        filtered = filtered.filter(r => !r.waterFlow || r.waterFlow === null || r.waterFlow === '');
      }
    }
    
    // Apply text search filter
    if (routeQuery.trim()) {
      const q = routeQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        (r.routeId + r.companyId + r.routeName + (r.waterFlowDisplay || '') + r.direction)
          .toLowerCase()
          .includes(q)
      );
    }
    
    return filtered;
  }, [rows, routeQuery, waterFlowFilter]);

  const filteredStations = useMemo(() => {
    if (!stationQuery.trim()) return stationRows;
    const q = stationQuery.toLowerCase();
    return stationRows.filter((r) =>
      (r.routeStationId + r.routeId + r.stationId + r.stationName + r.stopOrder)
        .toLowerCase()
        .includes(q)
    );
  }, [stationRows, stationQuery]);

  const selectedRouteId = useMemo(() => {
    const m = rows.find((r) => r.routeName === route);
    return m?.routeId || "";
  }, [rows, route]);

  const nextStopOrder = useMemo(() => {
    const list = stationRows.filter((s) => s.routeId === selectedRouteId);
    const max = Math.max(0, ...list.map((s) => Number(s.stopOrder) || 0));
    return max + 1;
  }, [stationRows, selectedRouteId]);

  // Helper function to get auth token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Helper function to format water flow display
  const getWaterFlowDisplay = (waterFlow) => {
    if (waterFlow === 'US') return 'Upstream';
    if (waterFlow === 'DS') return 'Downstream';
    if (waterFlow === null || waterFlow === '' || waterFlow === undefined) return 'N/A';
    return waterFlow;
  };

  // API Functions
  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      console.log("Fetching routes from:", `${apiUrl}/api/routes/`);
      
      const response = await fetch(`${apiUrl}/api/routes/`, {
        headers: getAuthHeaders()
      });
      
      console.log("Routes response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Routes data:", data);
        
        const mappedData = data.map(routeItem => ({
          routeId: routeItem.route_id,
          companyId: routeItem.company_id,
          routeName: routeItem.route_name,
          waterFlow: routeItem.water_flow,
          waterFlowDisplay: getWaterFlowDisplay(routeItem.water_flow),
          direction: routeItem.direction === 'FW' ? 'Forward' : 'Reverse',
          vehicleId: routeItem.vehicle_id
        }));
        setRows(mappedData);
        
        // Set first route as selected if none selected and routes exist
        if (mappedData.length > 0 && route === "") {
          setRoute(mappedData[0].routeName);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Routes fetch error:", response.status, errorData);
        setError(`Failed to fetch routes: ${errorData.error || response.statusText}`);
      }
    } catch (err) {
      console.error("Routes fetch exception:", err);
      setError('Error fetching routes: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [route]);

  const fetchAvailableStations = useCallback(async () => {
    try {
      console.log("Fetching available stations from:", `${apiUrl}/api/routes/available-stations`);
      
      const response = await fetch(`${apiUrl}/api/routes/available-stations`, {
        headers: getAuthHeaders()
      });
      
      console.log("Stations response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Available stations data:", data);
        
        const mappedData = data.map(station => ({
          id: station.station_id,
          name: station.station_name
        }));
        setAvailableStations(mappedData);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Available stations fetch error:", response.status, errorData);
      }
    } catch (err) {
      console.error('Error fetching available stations:', err);
    }
  }, []);

  const fetchRouteStations = useCallback(async (routeId) => {
    if (!routeId) return;
    try {
      console.log("Fetching route stations for:", routeId);
      
      const response = await fetch(`${apiUrl}/api/routes/stations/${routeId}`, {
        headers: getAuthHeaders()
      });
      
      console.log("Route stations response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Route stations data:", data);
        
        const mappedData = data.map(station => ({
          routeStationId: station.route_station_id,
          routeId: station.route_id,
          stationId: station.station_id,
          stationName: station.station_name,
          stopOrder: station.stop_order
        }));
        setStationRows(mappedData);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Route stations fetch error:", response.status, errorData);
      }
    } catch (err) {
      console.error('Error fetching route stations:', err);
    }
  }, []);

  const createRoute = async (routeData) => {
    try {
      setLoading(true);
      const payload = {
        route_name: routeData.routeName,
        water_flow: routeData.waterFlow === 'Upstream' ? 'US' : routeData.waterFlow === 'Downstream' ? 'DS' : null,
        direction: routeData.direction === 'Forward' ? 'FW' : 'RV'
      };

      const response = await fetch(`${apiUrl}/api/routes/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchRoutes();
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create route');
        return false;
      }
    } catch (err) {
      setError('Error creating route: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteRoute = async (routeId) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/routes/${routeId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        await fetchRoutes();
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete route');
        return false;
      }
    } catch (err) {
      setError('Error deleting route: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addRouteStation = async (stationData) => {
    try {
      setLoading(true);
      const payload = {
        route_id: stationData.routeId,
        station_id: stationData.stationId,
        stop_order: parseInt(stationData.stopOrder)
      };

      const response = await fetch(`${apiUrl}/api/routes/stations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchRouteStations(selectedRouteId);
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add station to route');
        return false;
      }
    } catch (err) {
      setError('Error adding station: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateRouteStation = async (routeStationId, stopOrder) => {
    try {
      setLoading(true);
      const payload = {
        stop_order: parseInt(stopOrder)
      };

      const response = await fetch(`${apiUrl}/api/routes/stations/${routeStationId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await fetchRouteStations(selectedRouteId);
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update route station');
        return false;
      }
    } catch (err) {
      setError('Error updating station: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteRouteStation = async (routeStationId) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/routes/stations/${routeStationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        await fetchRouteStations(selectedRouteId);
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete route station');
        return false;
      }
    } catch (err) {
      setError('Error deleting station: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchRoutes();
    fetchAvailableStations();
  }, [fetchRoutes, fetchAvailableStations]);

  // Load route stations when selected route changes
  useEffect(() => {
    if (selectedRouteId) {
      fetchRouteStations(selectedRouteId);
    }
  }, [selectedRouteId, fetchRouteStations]);

  /* ===== ROUTES handlers ===== */
  const openRouteAdd = () => {
    setRouteDraft({ 
      routeId: "", 
      companyId: "", 
      routeName: "", 
      waterFlow: "Downstream", 
      direction: "Forward" 
    });
    setRouteAddOpen(true);
    setError("");
  };

  const saveRouteAdd = () => { 
    setRouteAddOpen(false); 
    setRouteConfirm({ kind: "add", open: true }); 
  };

  const confirmRouteAdd = async () => { 
    const success = await createRoute(routeDraft);
    if (success) {
      setRouteConfirm({ kind: null, open: false });
    }
  };

  const openRouteEdit = (id) => {
    const r = rows.find((x) => x.routeId === id);
    if (!r) return;
    setRouteEdit({ ...r });
    setRouteEditOpen(true);
    setError("");
  };

  const saveRouteEdit = () => { 
    setRouteEditOpen(false); 
    setRouteConfirm({ kind: "edit", open: true }); 
  };

  const confirmRouteEdit = () => {
    // Note: Backend doesn't have update route endpoint, so we'll just close the modal
    // You may need to implement this endpoint in your backend
    setRows((p) => p.map((r) => (r.routeId === routeEdit.routeId ? { ...routeEdit } : r)));
    setRouteConfirm({ kind: null, open: false });
  };

  const openRouteDelete = (id) => { 
    setRouteToDelete(id); 
    setRouteConfirm({ kind: "delete", open: true }); 
    setError("");
  };

  const confirmRouteDelete = async () => {
    const success = await deleteRoute(routeToDelete);
    if (success) {
      setRouteToDelete(null);
      setRouteConfirm({ kind: null, open: false });
    }
  };

  /* ===== STATIONS handlers ===== */
  const openStationAdd = () => {
    const defaultStation = availableStations[0];
    if (defaultStation) {
      setStDraft({
        routeStationId: "",
        routeId: selectedRouteId,
        stationId: defaultStation.id,
        stationName: defaultStation.name,
        stopOrder: nextStopOrder,
      });
    }
    setStAddOpen(true);
    setError("");
  };

  const saveStationAdd = () => { 
    setStAddOpen(false); 
    setStConfirm({ kind: "add", open: true }); 
  };

  const confirmStationAdd = async () => {
    const success = await addRouteStation(stDraft);
    if (success) {
      setStConfirm({ kind: null, open: false });
    }
  };

  const openStationEdit = (routeStationId) => {
    const s = stationRows.find((x) => x.routeStationId === routeStationId);
    if (!s) return;
    setStEdit({ ...s });
    setStEditOpen(true);
    setError("");
  };

  const saveStationEdit = () => { 
    setStEditOpen(false); 
    setStConfirm({ kind: "edit", open: true }); 
  };

  const confirmStationEdit = async () => {
    const success = await updateRouteStation(stEdit.routeStationId, stEdit.stopOrder);
    if (success) {
      setStConfirm({ kind: null, open: false });
    }
  };

  const openStationDelete = (routeStationId) => { 
    setStToDelete(routeStationId); 
    setStConfirm({ kind: "delete", open: true }); 
    setError("");
  };

  const confirmStationDelete = async () => {
    const success = await deleteRouteStation(stToDelete);
    if (success) {
      setStToDelete(null);
      setStConfirm({ kind: null, open: false });
    }
  };

  return (
    <div className="ops-routes-container">
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <main className="ops-routes-main">
        {error && (
          <div className="error-message" style={{ color: 'red', margin: '10px 0', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <h3 className="ops-routes-table-title">Routes</h3>

        <label className="ops-routes-water-flow">
          Filter by Water Flow:
          <select 
            value={waterFlowFilter} 
            onChange={(e) => setWaterFlowFilter(e.target.value)}
          >
            <option value="All">All Routes</option>
            <option value="Upstream">Upstream (Water)</option>
            <option value="Downstream">Downstream (Water)</option>
            <option value="N/A">N/A (Land)</option>
          </select>
        </label>

        <div className="ops-routes-toolbar">
          <label className="ops-routes-search">
            <input
              className="ops-routes-search-input"
              type="text"
              placeholder="Search Routes"
              value={routeQuery}
              onChange={(e) => setRouteQuery(e.target.value)}
            />
          </label>

          <button 
            type="button" 
            className="ops-routes-add-btn" 
            onClick={openRouteAdd}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Add'}
          </button>
        </div>

        <div className="ops-routes-table-wrap">
          <table className="ops-routes-table">
            <thead>
              <tr>
                <th>Route_ID</th>
                <th>Company_ID</th>
                <th>Route Name</th>
                <th>Water Flow</th>
                <th>Direction</th>
                <th>Vehicle_ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoutes.map((r) => (
                <tr key={r.routeId}>
                  <td>{r.routeId}</td>
                  <td>{r.companyId}</td>
                  <td>{r.routeName}</td>
                  <td>{r.waterFlowDisplay}</td>
                  <td>{r.direction}</td>
                  <td>{r.vehicleId}</td>
                  <td className="ops-routes-actions">
                    <button 
                      className="ops-routes-action ops-routes-edit" 
                      onClick={() => openRouteEdit(r.routeId)}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button 
                      className="ops-routes-action ops-routes-delete" 
                      onClick={() => openRouteDelete(r.routeId)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRoutes.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                    No routes found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h3 className="ops-routes-table-title">Station and Route</h3>
        <label className="ops-routes-station-route">
          Route:
          <select 
            value={route} 
            onChange={(e) => setRoute(e.target.value)}
            disabled={rows.length === 0}
          >
            {rows.length === 0 ? (
              <option value="">No routes available</option>
            ) : (
              rows.map((r) => (
                <option key={r.routeId} value={r.routeName}>{r.routeName}</option>
              ))
            )}
          </select>
        </label>

        <div className="ops-routes-toolbar">
          <label className="ops-routes-search">
            <input
              className="ops-routes-search-input"
              type="text"
              placeholder="Search Stations"
              value={stationQuery}
              onChange={(e) => setStationQuery(e.target.value)}
            />
          </label>
          <button 
            type="button" 
            className="ops-routes-add-btn" 
            onClick={openStationAdd}
            disabled={loading || !selectedRouteId}
          >
            {loading ? 'Loading...' : 'Add'}
          </button>
        </div>

        <div className="ops-routes-table-wrap">
          <table className="ops-routes-table">
            <thead>
              <tr>
                <th>RouteStation_ID</th>
                <th>Route_ID</th>
                <th>Station_ID</th>
                <th>StationName</th>
                <th>StopOrder</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStations.map((s) => (
                <tr key={s.routeStationId}>
                  <td>{s.routeStationId}</td>
                  <td>{s.routeId}</td>
                  <td>{s.stationId}</td>
                  <td>{s.stationName}</td>
                  <td>{s.stopOrder}</td>
                  <td className="ops-routes-actions">
                    <button 
                      className="ops-routes-action ops-routes-edit" 
                      onClick={() => openStationEdit(s.routeStationId)}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button 
                      className="ops-routes-action ops-routes-delete" 
                      onClick={() => openStationDelete(s.routeStationId)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStations.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                    No stations found for this route
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* ===== ROUTE: add/edit/confirm ===== */}
      {routeAddOpen && (
        <div className="rt-modalOverlay" onClick={() => setRouteAddOpen(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Add Route</h3>
              <button className="rt-close" onClick={() => setRouteAddOpen(false)}>×</button>
            </div>
            <div className="rt-modalBody">
              <label>Route Name</label>
              <input 
                value={routeDraft.routeName} 
                onChange={(e) => setRouteDraft({ ...routeDraft, routeName: e.target.value })} 
                placeholder="Enter route name"
              />
              <label>Direction</label>
              <select value={routeDraft.direction} onChange={(e) => setRouteDraft({ ...routeDraft, direction: e.target.value })}>
                <option value="Forward">Forward</option>
                <option value="Reverse">Reverse</option>
              </select>
              <label>Water Flow</label>
              <select value={routeDraft.waterFlow} onChange={(e) => setRouteDraft({ ...routeDraft, waterFlow: e.target.value })}>
                <option value="Upstream">Upstream</option>
                <option value="Downstream">Downstream</option>
                <option value="Null">Null</option>
              </select>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setRouteAddOpen(false)}>Cancel</button>
              <button className="rt-btn rt-btnNavy" onClick={saveRouteAdd} disabled={!routeDraft.routeName}>Save</button>
            </div>
          </div>
        </div>
      )}

      {routeEditOpen && (
        <div className="rt-modalOverlay" onClick={() => setRouteEditOpen(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Edit Route</h3>
              <button className="rt-close" onClick={() => setRouteEditOpen(false)}>×</button>
            </div>
            <div className="rt-modalBody">
              <label>Route ID</label>
              <input value={routeEdit.routeId} disabled />
              <label>Company ID</label>
              <input value={routeEdit.companyId} disabled />
              <label>Route Name</label>
              <input value={routeEdit.routeName} onChange={(e) => setRouteEdit({ ...routeEdit, routeName: e.target.value })} />
              <label>Direction</label>
              <select value={routeEdit.direction} onChange={(e) => setRouteEdit({ ...routeEdit, direction: e.target.value })}>
                <option value="Forward">Forward</option>
                <option value="Reverse">Reverse</option>
              </select>
              <label>Water Flow</label>
              <select value={routeEdit.waterFlow} onChange={(e) => setRouteEdit({ ...routeEdit, waterFlow: e.target.value })}>
                <option value="Upstream">Upstream</option>
                <option value="Downstream">Downstream</option>
                <option value="Null">Null</option>
              </select>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setRouteEditOpen(false)}>Cancel</button>
              <button className="rt-btn rt-btnNavy" onClick={saveRouteEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {routeConfirm.open && (
        <div className="rt-modalOverlay" onClick={() => setRouteConfirm({ kind: null, open: false })}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">
                {routeConfirm.kind === "add" && "Confirm Add"}
                {routeConfirm.kind === "edit" && "Confirm Edit"}
                {routeConfirm.kind === "delete" && "Confirm Delete"}
              </h3>
            </div>
            <div className="rt-modalBody">
              {routeConfirm.kind === "delete"
                ? "Are you sure you want to delete this route? This will also delete all stations associated with this route."
                : "Are you sure you want to proceed?"}
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setRouteConfirm({ kind: null, open: false })}>Cancel</button>
              {routeConfirm.kind === "add" && <button className="rt-btn rt-btnNavy" onClick={confirmRouteAdd} disabled={loading}>Add</button>}
              {routeConfirm.kind === "edit" && <button className="rt-btn rt-btnNavy" onClick={confirmRouteEdit} disabled={loading}>Save</button>}
              {routeConfirm.kind === "delete" && <button className="rt-btn rt-btnNavy" onClick={confirmRouteDelete} disabled={loading}>Delete</button>}
            </div>
          </div>
        </div>
      )}

      {/* ====== STATION: Add ====== */}
      {stAddOpen && (
        <div className="rt-modalOverlay" onClick={() => setStAddOpen(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Add Station for Route</h3>
              <button className="rt-close" onClick={() => setStAddOpen(false)}>×</button>
            </div>

            <div className="rt-modalBody rt-stAddBody">
              <div className="rt-descRow">
                <span className="rt-descLabel">Route ID:</span>
                <span className="rt-descValue">{stDraft.routeId || selectedRouteId}</span>
              </div>
              <div className="rt-descRow">
                <span className="rt-descLabel">Station ID:</span>
                <span className="rt-descValue">{stDraft.stationId || "—"}</span>
              </div>

              <label className="rt-fieldLabel">Station</label>
              <select
                className="rt-select"
                value={stDraft.stationId}
                onChange={(e) => {
                  const st = availableStations.find((s) => s.id === e.target.value);
                  setStDraft((prev) => ({
                    ...prev,
                    stationId: st?.id || "",
                    stationName: st?.name || "",
                  }));
                }}
              >
                {availableStations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <label className="rt-fieldLabel">Stop Order</label>
              <input
                type="number"
                className="rt-input"
                min="1"
                value={stDraft.stopOrder}
                onChange={(e) => setStDraft({ ...stDraft, stopOrder: e.target.value })}
              />
            </div>

            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setStAddOpen(false)}>Cancel</button>
              <button className="rt-btn rt-btnNavy" onClick={saveStationAdd} disabled={!stDraft.stationId}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* STATION: Edit & Confirm */}
      {stEditOpen && (
        <div className="rt-modalOverlay" onClick={() => setStEditOpen(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Edit Station Route</h3>
              <button className="rt-close" onClick={() => setStEditOpen(false)}>×</button>
            </div>
            <div className="rt-modalBody">
              <label>RouteStation ID</label>
              <input value={stEdit.routeStationId} disabled />
              <label>Route ID</label>
              <input value={stEdit.routeId} disabled />
              <label>Station ID</label>
              <input value={stEdit.stationId} disabled />
              <label>Station Name</label>
              <input value={stEdit.stationName} disabled />
              <label>Stop Order</label>
              <input 
                type="number" 
                min="1" 
                value={stEdit.stopOrder} 
                onChange={(e) => setStEdit({ ...stEdit, stopOrder: e.target.value })} 
              />
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setStEditOpen(false)}>Cancel</button>
              <button className="rt-btn rt-btnNavy" onClick={saveStationEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {stConfirm.open && (
        <div className="rt-modalOverlay" onClick={() => setStConfirm({ kind: null, open: false })}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">
                {stConfirm.kind === "add" && "Confirm Add"}
                {stConfirm.kind === "edit" && "Confirm Edit"}
                {stConfirm.kind === "delete" && "Confirm Delete"}
              </h3>
            </div>
            <div className="rt-modalBody">
              {stConfirm.kind === "delete"
                ? "Are you sure you want to delete this station from the route?"
                : "Are you sure you want to proceed?"}
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setStConfirm({ kind: null, open: false })}>Cancel</button>
              {stConfirm.kind === "add" && <button className="rt-btn rt-btnNavy" onClick={confirmStationAdd} disabled={loading}>Add</button>}
              {stConfirm.kind === "edit" && <button className="rt-btn rt-btnNavy" onClick={confirmStationEdit} disabled={loading}>Save</button>}
              {stConfirm.kind === "delete" && <button className="rt-btn rt-btnNavy" onClick={confirmStationDelete} disabled={loading}>Delete</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}