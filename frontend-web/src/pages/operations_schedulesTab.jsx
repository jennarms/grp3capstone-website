import { useCallback, useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_schedulesTab.css";

export function SchedulesTab() {
  // API configuration
  const apiUrl = import.meta.env.VITE_API_URL;
  
  // Route selection
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stations, setStations] = useState([]);
  const [schedules, setSchedules] = useState([]);

  // UI states
  const [editingRideId, setEditingRideId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modals
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [showDeleteRow, setShowDeleteRow] = useState(false);
  const [rideIdToDelete, setRideIdToDelete] = useState(null);

  // Get auth token
  const getAuthToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  };

  // API call helper
  const apiCall = useCallback(async (endpoint, options = {}) => {
    const token = getAuthToken();
    const url = `${apiUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      console.error(`API call failed for ${endpoint}:`, err);
      throw err;
    }
  }, [apiUrl]);

  // Fetch routes for dropdown
  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const routesData = await apiCall('/api/schedules/routes');
      setRoutes(routesData);
      
      // Auto-select first route if none selected
      if (routesData.length > 0 && !selectedRoute) {
        setSelectedRoute(routesData[0]);
      }
    } catch (err) {
      setError(`Failed to fetch routes: ${err.message}`);
      console.error('Error fetching routes:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedRoute, apiCall]);

  // Fetch stations for selected route
  const fetchStations = useCallback(async (routeId) => {
    try {
      setLoading(true);
      const stationsData = await apiCall(`/api/schedules/stations?Route_ID=${routeId}`);
      setStations(stationsData);
    } catch (err) {
      setError(`Failed to fetch stations: ${err.message}`);
      console.error('Error fetching stations:', err);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Fetch schedules for selected route
  const fetchSchedules = useCallback(async (routeId) => {
    try {
      setLoading(true);
      const schedulesData = await apiCall(`/api/schedules/by-route?Route_ID=${routeId}`);
      setSchedules(schedulesData);
    } catch (err) {
      setError(`Failed to fetch schedules: ${err.message}`);
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Create new ride
  const createRide = async () => {
    if (!selectedRoute || !stations.length) return;

    const departureTimes = stations.map(station => ({
      RouteStation_ID: station.RouteStation_ID,
      StopOrder: station.StopOrder,
      departureTime: null
    }));

    try {
      setLoading(true);
      setError(null);
      await apiCall('/api/schedules/create', {
        method: 'POST',
        body: JSON.stringify({
          Route_ID: selectedRoute.Route_ID,
          departureTimes: departureTimes
        }),
      });
      
      // Refresh schedules after creation
      await fetchSchedules(selectedRoute.Route_ID);
      setShowAddRow(false);
    } catch (err) {
      setError(`Failed to create ride: ${err.message}`);
      console.error('Error creating ride:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update ride
  const updateRide = async (rideId) => {
    const ride = schedules.find(r => r.Ride_ID === rideId);
    if (!ride) return;

    const departureTimes = ride.stations.map(station => ({
      RouteStation_ID: station.RouteStation_ID,
      StopOrder: station.StopOrder,
      departureTime: station.departureTime || null
    }));

    try {
      setLoading(true);
      setError(null);
      await apiCall(`/api/schedules/update/${rideId}`, {
        method: 'PUT',
        body: JSON.stringify({
          departureTimes: departureTimes
        }),
      });
      
      // Refresh schedules after update
      await fetchSchedules(selectedRoute.Route_ID);
      setEditingRideId(null);
    } catch (err) {
      setError(`Failed to update ride: ${err.message}`);
      console.error('Error updating ride:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete ride
  const deleteRide = async (rideId) => {
    try {
      setLoading(true);
      setError(null);
      await apiCall(`/api/schedules/delete/${rideId}`, {
        method: 'DELETE',
      });
      
      // Refresh schedules after deletion
      await fetchSchedules(selectedRoute.Route_ID);
      setRideIdToDelete(null);
      setShowDeleteRow(false);
    } catch (err) {
      setError(`Failed to delete ride: ${err.message}`);
      console.error('Error deleting ride:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load routes on component mount
  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  // Load stations and schedules when route changes
  useEffect(() => {
    if (selectedRoute) {
      fetchStations(selectedRoute.Route_ID);
      fetchSchedules(selectedRoute.Route_ID);
    }
  }, [selectedRoute, fetchStations, fetchSchedules]);

  // Handle route selection change
  const handleRouteChange = (e) => {
    const routeId = e.target.value;
    const route = routes.find(r => r.Route_ID === routeId);
    setSelectedRoute(route);
    setSchedules([]);
    setEditingRideId(null);
  };

  // Handle cell change in schedule table
  const onCellChange = (rideId, routeStationId, value) => {
    setSchedules(prev => prev.map(ride => {
      if (ride.Ride_ID === rideId) {
        return {
          ...ride,
          stations: ride.stations.map(station => {
            if (station.RouteStation_ID === routeStationId) {
              return { ...station, departureTime: value };
            }
            return station;
          })
        };
      }
      return ride;
    }));
  };

  // Format time for display (convert from HH:MM:SS to HH:MM AM/PM)
  const formatTimeForDisplay = (timeStr) => {
    if (!timeStr) return "";
    
    try {
      // Handle both HH:MM:SS and HH:MM formats
      const timeParts = timeStr.split(':');
      let hours = parseInt(timeParts[0]);
      const minutes = timeParts[1];
      
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      
      return `${hours}:${minutes} ${ampm}`;
    } catch {
      return timeStr; // Return original if parsing fails
    }
  };

  // Start editing a ride
  const startEditingRide = (rideId) => {
    setEditingRideId(rideId);
  };

  // Save ride changes
  const saveRideChanges = async () => {
    if (editingRideId) {
      await updateRide(editingRideId);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingRideId(null);
    // Refresh to restore original data
    if (selectedRoute) {
      fetchSchedules(selectedRoute.Route_ID);
    }
  };

  // Confirm delete ride
  const confirmDeleteRide = (rideId) => {
    setRideIdToDelete(rideId);
    setShowDeleteRow(true);
  };

  // Execute delete ride
  const executeDeleteRide = async () => {
    if (rideIdToDelete) {
      await deleteRide(rideIdToDelete);
    }
  };

  // Save all changes (implement button)
  const onSave = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (editingRideId) {
      await saveRideChanges();
    }
    setShowConfirm(false);
  };

  const handleConfirmCancel = () => {
    setShowConfirm(false);
  };

  // ESC closes modals/popovers
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

  // Export PDF (Save a Copy)
  const exportToPDF = () => {
    if (!selectedRoute || !stations.length || !schedules.length) {
      setError('No data to export. Please select a route with schedules.');
      return;
    }

    // Create a new window for the PDF content
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ferry Schedule - ${selectedRoute.Route_name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          h1 {
            color: #0b1a78;
            text-align: center;
            margin-bottom: 10px;
          }
          .route-info {
            text-align: center;
            margin-bottom: 20px;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: center;
          }
          th {
            background-color: #0b1a78;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          tr:hover {
            background-color: #f5f5f5;
          }
          .ride-id {
            font-weight: bold;
            background-color: #e3f2fd !important;
          }
          .empty-time {
            color: #999;
            font-style: italic;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Ferry Schedule</h1>
        <div class="route-info">
          <strong>Route:</strong> ${selectedRoute.Route_name}<br>
          <strong>Water Flow:</strong> ${selectedRoute.Water_flow}<br>
          <strong>Generated:</strong> ${new Date().toLocaleString()}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Ride ID</th>
              ${stations.map(station => `<th>${station.StationName}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${schedules.map(ride => `
              <tr>
                <td class="ride-id">${ride.Ride_ID}</td>
                ${ride.stations.map(station => `
                  <td>${station.departureTime 
                    ? formatTimeForDisplay(station.departureTime)
                    : '<span class="empty-time">--:-- --</span>'
                  }</td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          Ferry Schedule Management System<br>
          This schedule is subject to change based on weather conditions and operational requirements.
        </div>
        
        <script>
          // Auto print when page loads
          window.onload = function() {
            window.print();
            // Close window after printing (optional)
            setTimeout(() => window.close(), 1000);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <div className="ops-sch-page">
        <div className="ops-sch-main">
          <h2 className="ops-sch-title">Schedules</h2>

          {/* Error display */}
          {error && (
            <div className="error-message" style={{ 
              color: 'red', 
              background: '#ffebee', 
              padding: '10px', 
              borderRadius: '4px', 
              marginBottom: '16px' 
            }}>
              {error}
              <button 
                onClick={() => setError(null)} 
                style={{ 
                  float: 'right', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer' 
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Route selector */}
          <div className="route-selector" style={{ marginBottom: '16px' }}>
            <label htmlFor="route-select">Select Route: </label>
            <select 
              id="route-select"
              value={selectedRoute?.Route_ID || ''} 
              onChange={handleRouteChange}
              disabled={loading}
              style={{ 
                marginLeft: '8px', 
                padding: '4px 8px', 
                border: '1px solid #ccc', 
                borderRadius: '4px' 
              }}
            >
              <option value="">Choose a route...</option>
              {routes.map(route => (
                <option key={route.Route_ID} value={route.Route_ID}>
                  {route.Route_name} ({route.Water_flow})
                </option>
              ))}
            </select>
          </div>

          {/* Top controls */}
          <div className="ops-sch-topbar">
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
                  className="ops-sch-edit"
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

          {loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              Loading...
            </div>
          )}

          {selectedRoute && stations.length > 0 && (
            <div className="ops-sch-table-wrap" role="region" aria-label="Schedule Preview">
              <table className="ops-sch-table">
                <thead>
                  <tr>
                    <th>Ride ID</th>
                    {stations.map(station => (
                      <th key={station.RouteStation_ID}>
                        {station.StationName}
                      </th>
                    ))}
                    <th className="action-col">ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {schedules.map((ride) => (
                    <tr key={ride.Ride_ID}>
                      <td style={{ fontWeight: 'bold' }}>
                        {ride.Ride_ID}
                      </td>
                      {ride.stations.map((station) => (
                        <td key={station.RouteStation_ID}>
                          <input
                            className="sch-cell"
                            value={editingRideId === ride.Ride_ID 
                              ? (station.departureTime || '') 
                              : formatTimeForDisplay(station.departureTime || '')
                            }
                            onChange={(e) => {
                              if (editingRideId === ride.Ride_ID) {
                                onCellChange(ride.Ride_ID, station.RouteStation_ID, e.target.value);
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
                            onClick={() => saveRideChanges()}
                            disabled={loading}
                          >
                            ✓
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="icon-btn"
                              title="Edit ride"
                              onClick={() => startEditingRide(ride.Ride_ID)}
                              disabled={loading || editingRideId !== null}
                              style={{ 
                                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230b1a78' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/%3E%3Cpath d='M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/%3E%3C/svg%3E\")"
                              }}
                            >
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              title="Delete ride"
                              aria-label={`Delete ride ${ride.Ride_ID}`}
                              onClick={() => confirmDeleteRide(ride.Ride_ID)}
                              disabled={loading || editingRideId !== null}
                            >
                            </button>
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
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              No stations found for this route.
            </div>
          )}

          {!selectedRoute && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
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

      {/* Confirm dialog (Implement) */}
      {showConfirm && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={handleConfirmCancel}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 id="confirm-title">Save Changes</h3>
            <p>Are you sure you want to save these schedule changes?</p>
            <div className="confirm-buttons">
              <button className="cancel-btn" type="button" onClick={handleConfirmCancel} autoFocus>
                Cancel
              </button>
              <button className="yes-btn" type="button" onClick={handleConfirmSave} disabled={loading}>
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add chooser modal */}
      {showAddChooser && (
        <div className="addch-overlay" role="dialog" aria-modal="true" aria-labelledby="add-chooser-title" onClick={() => setShowAddChooser(false)}>
          <div className="addch-box" onClick={(e) => e.stopPropagation()}>
            <h3 id="add-chooser-title" className="addch-title">Add New Ride</h3>
            <p>This will create a new ride with empty time slots for all stations on the selected route.</p>
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
                onClick={() => { setShowAddChooser(false); setShowAddRow(true); }}
              >
                Add Ride
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Row modal */}
      {showAddRow && (
        <div className="rt-modalOverlay" role="dialog" aria-modal="true" aria-labelledby="add-row-title" onClick={() => setShowAddRow(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 id="add-row-title" className="rt-modalTitle">Add New Ride</h3>
              <button className="rt-close" onClick={() => setShowAddRow(false)} aria-label="Close">×</button>
            </div>
            <div className="rt-modalBody">
              <p>This will create a new ride for route: <strong>{selectedRoute?.Route_name}</strong></p>
              <p>The ride will include all {stations.length} stations with empty time slots that you can edit.</p>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setShowAddRow(false)}>
                Cancel
              </button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={createRide}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Ride'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE RIDE modal */}
      {showDeleteRow && rideIdToDelete && (
        <div className="rt-modalOverlay" role="dialog" aria-modal="true" aria-labelledby="delete-row-title" onClick={() => setShowDeleteRow(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 id="delete-row-title" className="rt-modalTitle">Delete Ride</h3>
              <button className="rt-close" onClick={() => setShowDeleteRow(false)} aria-label="Close">×</button>
            </div>
            <div className="rt-modalBody">
              <p>Are you sure you want to delete ride <strong>{rideIdToDelete}</strong>?</p>
              <p>This will permanently remove all schedule entries for this ride.</p>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setShowDeleteRow(false)}>
                Cancel
              </button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={executeDeleteRide}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Ride'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}