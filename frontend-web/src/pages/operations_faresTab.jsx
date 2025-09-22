import { useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_faresTab.css";

const apiUrl = import.meta.env.VITE_API_URL;
console.log("API URL from env:", apiUrl);

export default function FareTab() {
  const [stations, setStations] = useState([]);
  const [fareMatrix, setFareMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingStations, setEditingStations] = useState([]);
  const [viewMode, setViewMode] = useState('fare');
  const [fareStats, setFareStats] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});

  // Get auth token
  const getAuthToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  };

  // Show message helper
  const showMessage = (message, type = 'success') => {
    if (type === 'success') {
      setSuccess(message);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(message);
      setSuccess(null);
      setTimeout(() => setError(null), 5000);
    }
  };

  // Sync stations from Station table to Station_Master
  const syncStations = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${apiUrl}/api/fare/stations/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync stations');
      }

      const result = await response.json();
      showMessage(result.message);
      await fetchStations();
    } catch (err) {
      showMessage('Error syncing stations: ' + err.message, 'error');
    }
  };

  // Fetch stations from API
  const fetchStations = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${apiUrl}/api/fare/stations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        }
        throw new Error(`Failed to fetch stations: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.stations) {
        setStations(data.stations);
        setEditingStations([...data.stations]);
        
        if (data.stations.length === 0 && data.debug_info) {
          console.log('Debug info:', data.debug_info);
          if (data.debug_info.main_station_count > 0) {
            showMessage(`Found ${data.debug_info.main_station_count} stations in main table but Station_Master is empty. Click 'Sync Stations' to populate it.`, 'error');
          } else {
            showMessage('No stations found in either table. Please add stations first.', 'error');
          }
        }
      } else {
        setStations(data);
        setEditingStations([...data]);
      }
    } catch (err) {
      showMessage('Error fetching stations: ' + err.message, 'error');
      console.error('Error fetching stations:', err);
    }
  };

  // Fetch fare matrix from API
  const fetchFareMatrix = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${apiUrl}/api/fare/matrix`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        }
        throw new Error(`Failed to fetch fare matrix: ${response.statusText}`);
      }

      const data = await response.json();
      setFareMatrix(data);
    } catch (err) {
      showMessage('Error fetching fare matrix: ' + err.message, 'error');
      console.error('Error fetching fare matrix:', err);
    }
  };

  // Fetch fare statistics
  const fetchFareStats = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${apiUrl}/api/fare/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFareStats(data);
      }
    } catch (err) {
      console.error('Error fetching fare stats:', err);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStations(), 
        fetchFareMatrix(),
        fetchFareStats()
      ]);
      setLoading(false);
    };
    initializeData();
  }, []);

  // Handle station order update in editing mode
  const handleStationOrderUpdate = (stationId, newOrder) => {
    const orderNum = parseInt(newOrder);
    if (isNaN(orderNum) || orderNum < 1) return;

    setEditingStations(prevStations => 
      prevStations.map(station => 
        station.Station_ID === stationId 
          ? { ...station, StopOrder: orderNum }
          : station
      ).sort((a, b) => a.StopOrder - b.StopOrder)
    );
  };

  // Save station master order
  const saveStationOrder = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${apiUrl}/api/fare/stations/order`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stations: editingStations })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update station order');
      }

      showMessage('Station order updated successfully');
      setStations([...editingStations]);
      
      await regenerateFareMatrix();
      setViewMode('fare');
      
    } catch (err) {
      showMessage('Error updating station order: ' + err.message, 'error');
    }
  };

  // Regenerate fare matrix
  const regenerateFareMatrix = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${apiUrl}/api/fare/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate fare matrix');
      }

      const result = await response.json();
      showMessage(`${result.message}. Created ${result.new_fares_created} new fare entries.`);
      
      await Promise.all([fetchFareMatrix(), fetchFareStats()]);
      
    } catch (err) {
      showMessage('Error regenerating fare matrix: ' + err.message, 'error');
    }
  };

  // Handle fare change
  const handleFareChange = (fareId, newFare) => {
    setFareMatrix(prevMatrix => 
      prevMatrix.map(fare => 
        fare.Fare_ID === fareId 
          ? { ...fare, Fare: parseFloat(newFare) || 0 }
          : fare
      )
    );

    setPendingChanges(prev => ({
      ...prev,
      [fareId]: { Fare: parseFloat(newFare) || 0 }
    }));
  };

  // Save individual fare
  const saveFare = async (fareId, fareValue, isActive = null) => {
    try {
      const token = getAuthToken();
      const updateData = { Fare: parseFloat(fareValue) || 0 };
      if (isActive !== null) {
        updateData.Active = isActive;
      }

      const response = await fetch(`${apiUrl}/api/fare/update/${fareId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update fare');
      }

      setPendingChanges(prev => {
        const newPending = { ...prev };
        delete newPending[fareId];
        return newPending;
      });

      showMessage('Fare updated successfully');
      await fetchFareStats();
      
    } catch (err) {
      showMessage('Error updating fare: ' + err.message, 'error');
      await fetchFareMatrix();
    }
  };

  // Toggle fare active status
  const toggleFareStatus = async (fareId, currentStatus) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${apiUrl}/api/fare/update/${fareId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Active: !currentStatus })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update fare status');
      }

      setFareMatrix(prevMatrix => 
        prevMatrix.map(fare => 
          fare.Fare_ID === fareId 
            ? { ...fare, Active: !currentStatus }
            : fare
        )
      );

      showMessage(`Fare ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
      await fetchFareStats();
      
    } catch (err) {
      showMessage('Error updating fare status: ' + err.message, 'error');
    }
  };

  // NEW: Bulk enable/disable all fares
  const bulkToggleAllFares = async (enableAll = true) => {
    try {
      const token = getAuthToken();
      const activeFares = fareMatrix.filter(fare => fare.Fare_ID !== null);
      
      if (activeFares.length === 0) {
        showMessage('No fares to update', 'error');
        return;
      }

      const fareUpdates = activeFares.map(fare => ({
        Fare_ID: fare.Fare_ID,
        Active: enableAll
      }));

      const response = await fetch(`${apiUrl}/api/fare/update/bulk`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fares: fareUpdates })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to bulk update fares');
      }

      // Update local state
      setFareMatrix(prevMatrix => 
        prevMatrix.map(fare => 
          fare.Fare_ID !== null 
            ? { ...fare, Active: enableAll }
            : fare
        )
      );

      showMessage(`Successfully ${enableAll ? 'enabled' : 'disabled'} ${fareUpdates.length} fares`);
      await fetchFareStats();
      
    } catch (err) {
      showMessage(`Error ${enableAll ? 'enabling' : 'disabling'} all fares: ` + err.message, 'error');
    }
  };

  // Save all pending changes
  const saveAllPendingChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      showMessage('No changes to save', 'error');
      return;
    }

    const fareUpdates = Object.entries(pendingChanges).map(([fareId, changes]) => ({
      Fare_ID: parseInt(fareId),
      ...changes
    }));

    try {
      const token = getAuthToken();
      const response = await fetch(`${apiUrl}/api/fare/update/bulk`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fares: fareUpdates })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes');
      }

      setPendingChanges({});
      showMessage(`Successfully saved ${fareUpdates.length} fare changes`);
      await fetchFareStats();
      
    } catch (err) {
      showMessage('Error saving changes: ' + err.message, 'error');
    }
  };

  // Create fare matrix for display
  const createFareMatrixDisplay = () => {
    if (!stations.length || !fareMatrix.length) return { matrix: [], activeStations: [] };

    const activeStations = stations.filter(station => station.Active);
    const matrix = [];

    activeStations.forEach((fromStation) => {
      const row = [];
      activeStations.forEach((toStation) => {
        if (fromStation.Station_ID === toStation.Station_ID) {
          row.push({ fare: 0, isDisabled: true, fareId: null, active: false });
        } else {
          const fareEntry = fareMatrix.find(f => 
            f.From_Station_ID === fromStation.Station_ID && 
            f.To_Station_ID === toStation.Station_ID
          );
          row.push({
            fare: fareEntry ? fareEntry.Fare : 0,
            fareId: fareEntry ? fareEntry.Fare_ID : null,
            active: fareEntry ? fareEntry.Active : false,
            isDisabled: false,
            fromName: fromStation.StationName,
            toName: toStation.StationName
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
            <h2 className="fare-tab-section">Fare</h2>
            <div className="loading-container">
              Loading fare data...
            </div>
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
          <h2 className="fare-tab-section">Fare Management</h2>

          {error && (
            <div className="message-box error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="message-box success-message">
              {success}
            </div>
          )}

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

          <div className="control-buttons">
            <button
              className={`tab-button ${viewMode === 'fare' ? 'active' : ''}`}
              onClick={() => setViewMode('fare')}
            >
              Fare Matrix
            </button>
            <button
              className={`tab-button ${viewMode === 'stationMaster' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('stationMaster');
                setEditingStations([...stations]);
              }}
            >
              Station Master
            </button>
            {stations.length === 0 && (
              <button className="sync-button" onClick={syncStations}>
                Sync Stations
              </button>
            )}
            {Object.keys(pendingChanges).length > 0 && (
              <button className="save-all-button" onClick={saveAllPendingChanges}>
                Save All Changes ({Object.keys(pendingChanges).length})
              </button>
            )}
          </div>

          {viewMode === 'stationMaster' && (
            <div className="station-master-section">
              <h3>Station Order Management</h3>
              <p className="description">
                Set the order of stations for the fare matrix generation. Lower numbers appear first.
              </p>
              
              {editingStations.length > 0 ? (
                <div className="station-table-container">
                  <div className="scrollable-table">
                    <table className="station-master-table">
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
                            <td className="station-name">
                              {station.StationName}
                            </td>
                            <td>
                              <input
                                className="order-input"
                                type="number"
                                value={station.StopOrder}
                                onChange={(e) => handleStationOrderUpdate(station.Station_ID, e.target.value)}
                                min="1"
                              />
                            </td>
                            <td>
                              <span className={`status-badge ${station.Active ? 'active' : 'inactive'}`}>
                                {station.Active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="station-id">
                              {station.Station_ID}
                            </td>
                            <td>
                              <button 
                                className="edit-button"
                                onClick={() => {
                                  const hasChanges = JSON.stringify(editingStations) !== JSON.stringify(stations);
                                  if (hasChanges) {
                                    saveStationOrder();
                                  } else {
                                    showMessage('No changes to save', 'error');
                                  }
                                }}
                              >
                                Save Changes
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
                  <button className="sync-button" onClick={syncStations}>
                    Sync Stations from Main Table
                  </button>
                </div>
              )}
            </div>
          )}

          {viewMode === 'fare' && (
            <div className="fare-matrix-section">
              <div className="matrix-controls">
                <button className="regenerate-button" onClick={regenerateFareMatrix}>
                  Regenerate Matrix
                </button>
                {/* NEW: Bulk toggle buttons */}
                <button 
                  className="regenerate-button" 
                  style={{ backgroundColor: '#28a745' }}
                  onClick={() => bulkToggleAllFares(true)}
                  disabled={fareMatrix.length === 0}
                >
                  Enable All Fares
                </button>
                <button 
                  className="regenerate-button" 
                  style={{ backgroundColor: '#dc3545' }}
                  onClick={() => bulkToggleAllFares(false)}
                  disabled={fareMatrix.length === 0}
                >
                  Disable All Fares
                </button>
                <span className="help-text">
                  Click to regenerate the fare matrix based on current active stations, or bulk enable/disable all fares
                </span>
              </div>

              {activeStations.length > 0 && fareDisplayMatrix.length > 0 ? (
                <div className="fare-matrix-container">
                  <div className="fare-table-wrapper">
                    <table className="fare-matrix-table">
                      <thead>
                        <tr>
                          <th className="corner-header">FROM / TO</th>
                          {activeStations.map((station, index) => (
                            <th key={index} className="station-header">
                              <div className="rotated-header">
                                {station.StationName}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fareDisplayMatrix.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <td className="row-header">
                              {activeStations[rowIndex]?.StationName}
                            </td>
                            {row.map((cell, colIndex) => (
                              <td 
                                key={colIndex} 
                                className={`fare-cell ${
                                  cell.isDisabled ? 'disabled' : 
                                  !cell.active ? 'inactive' :
                                  pendingChanges[cell.fareId] ? 'pending' : 'active'
                                }`}
                              >
                                {cell.isDisabled ? (
                                  <div className="disabled-cell">-</div>
                                ) : (
                                  <div className="cell-content">
                                    <input
                                      className="fare-input"
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={cell.fare}
                                      onChange={(e) => cell.fareId && handleFareChange(cell.fareId, e.target.value)}
                                      onBlur={(e) => cell.fareId && saveFare(cell.fareId, e.target.value)}
                                      disabled={!cell.fareId}
                                      placeholder="0.00"
                                    />
                                    {cell.fareId && (
                                      <button
                                        className={`status-toggle ${cell.active ? 'active' : 'inactive'}`}
                                        onClick={() => toggleFareStatus(cell.fareId, cell.active)}
                                      >
                                        {cell.active ? 'Active' : 'Disabled'}
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
                  <button className="regenerate-button" onClick={regenerateFareMatrix}>
                    Generate Fare Matrix
                  </button>
                </div>
              )}

              <div className="instructions">
                <p><strong>Instructions:</strong></p>
                <ul>
                  <li>Edit fares directly in the matrix cells - changes save automatically when you click outside the field</li>
                  <li>Click the status button below each fare to enable/disable specific routes</li>
                  <li>Use "Enable All Fares" or "Disable All Fares" buttons to bulk toggle all fare statuses</li>
                  <li>Yellow highlighting indicates unsaved changes</li>
                  <li>Use "Station Master" to reorder stations before generating the matrix</li>
                  <li>Disabled routes will appear with a red background</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}