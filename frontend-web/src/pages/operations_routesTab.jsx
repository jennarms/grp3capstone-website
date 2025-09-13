import React, { useState, useMemo } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import { OperationsTab } from "../components/operationsTab";
import "./operations_routesTab.css";

export function RoutesTab() {
  const [rows, setRows] = useState([
    { routeId: "R001", companyId: "C001", routeName: "Escolta-Kalawaan", waterFlow: "Upstream", direction: "Forward" },
    { routeId: "R002", companyId: "C001", routeName: "Kalawaan-Escolta", waterFlow: "Upstream", direction: "Reverse" },
    { routeId: "R003", companyId: "C001", routeName: "Escolta-Pinagbuhatan", waterFlow: "Downstream", direction: "Forward" },
    { routeId: "R004", companyId: "C001", routeName: "Pinagbuhatan-Escolta", waterFlow: "Downstream", direction: "Reverse" },
  ]);

  const [stationRows, setStationRows] = useState([
    { routeStationId: "RS001", routeId: "R001", stationId: "S001", stationName: "Escolta", stopOrder: 1 },
    { routeStationId: "RS002", routeId: "R001", stationId: "S002", stationName: "Lawton", stopOrder: 2 },
    { routeStationId: "RS003", routeId: "R001", stationId: "S003", stationName: "Quinta", stopOrder: 3 },
  ]);

  const [query, setQuery] = useState("");
  const [route, setRoute] = useState("Escolta-Kalawaan");
  const [modalOpen, setModalOpen] = useState(false); // State to manage modal visibility
  const [editModalOpen, setEditModalOpen] = useState(false); // State for edit modal
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false); // State for confirmation dialog
  const [editConfirmationDialogOpen, setEditConfirmationDialogOpen] = useState(false); // State for edit confirmation dialog
  const [newRoute, setNewRoute] = useState({
    routeId: "",
    companyId: "C001", // Default to "C001" for new route
    routeName: "",
    waterFlow: "Downstream",
    direction: "Forward",
  });
  const [editRoute, setEditRoute] = useState({
    routeId: "",
    companyId: "C001", // Company ID visible and editable in the edit modal
    routeName: "",
    waterFlow: "Downstream",
    direction: "Forward",
  });

  const [deleteConfirmationDialogOpen, setDeleteConfirmationDialogOpen] = useState(false); // State for delete confirmation dialog
  const [routeToDelete, setRouteToDelete] = useState(null); // Store the route to delete
  const [stationRouteToDelete, setStationRouteToDelete] = useState(null); // Store the station-route to delete

  const filteredRoutes = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      (r.routeId + r.companyId + r.routeName + r.waterFlow + r.direction)
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const filteredStations = useMemo(() => {
    if (!query.trim()) return stationRows;
    const q = query.toLowerCase();
    return stationRows.filter((r) =>
      (r.routeStationId + r.routeId + r.stationId + r.stationName)
        .toLowerCase()
        .includes(q)
    );
  }, [stationRows, query]);

  const handleModalClose = () => setModalOpen(false);
  const handleModalOpen = () => setModalOpen(true);

  const handleEditModalClose = () => setEditModalOpen(false);
  const handleEditModalOpen = (routeStationId) => {
    const stationToEdit = stationRows.find((station) => station.routeStationId === routeStationId);
    setEditRoute({ ...stationToEdit });
    setEditModalOpen(true);
  };

  const handleChange = (e) => {
    setNewRoute({ ...newRoute, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditRoute({ ...editRoute, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    setModalOpen(false); // Close the modal
    setConfirmationDialogOpen(true); // Open confirmation dialog for add
  };

  const handleEditSave = () => {
    setEditConfirmationDialogOpen(true); // Open confirmation dialog for edit (do not save immediately)
  };

  const handleConfirmationClose = (confirmed) => {
    if (confirmed) {
      setRows([...rows, newRoute]); // Add the new route
    }
    setConfirmationDialogOpen(false); // Close the confirmation dialog
  };

  const handleEditConfirmationClose = (confirmed) => {
    if (confirmed) {
      const updatedRoutes = rows.map((route) =>
        route.routeId === editRoute.routeId ? editRoute : route
      );
      setRows(updatedRoutes); // Update the edited route
    }
    setEditConfirmationDialogOpen(false); // Close the edit confirmation dialog
  };

  const handleDeleteOpen = (routeId) => {
    setRouteToDelete(routeId); // Set the route to delete
    setDeleteConfirmationDialogOpen(true); // Open the delete confirmation dialog
  };

  const handleDeleteStationOpen = (routeStationId) => {
    setStationRouteToDelete(routeStationId); // Set the station-route to delete
    setDeleteConfirmationDialogOpen(true); // Open the delete confirmation dialog
  };

  const handleDeleteConfirmationClose = (confirmed) => {
    if (confirmed && routeToDelete) {
      setRows(rows.filter((route) => route.routeId !== routeToDelete)); // Delete the route
    }
    if (confirmed && stationRouteToDelete) {
      setStationRows(stationRows.filter((route) => route.routeStationId !== stationRouteToDelete)); // Delete the station-route
    }
    setDeleteConfirmationDialogOpen(false); // Close the dialog
    setRouteToDelete(null); // Clear the route to delete
    setStationRouteToDelete(null); // Clear the station-route to delete
  };

  return (
    <div className="ops-routes-container">
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <main className="ops-routes-main">
        <h3 className="ops-routes-table-title">Routes</h3>

        <label className="ops-routes-water-flow">
          Enable Water Flow:
          <select>
            <option value="Upstream">Upstream</option>
            <option value="Downstream" selected>Downstream</option>
            <option value="Null">Null</option>
          </select>
        </label>

        <div className="ops-routes-toolbar">
          <label className="ops-routes-search">
            <input
              className="ops-routes-search-input"
              type="text"
              placeholder="Search Routes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <button type="button" className="ops-routes-add-btn" onClick={handleModalOpen}>Add</button>
        </div>

        {/* Modal for adding route */}
        {modalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h4>Add Routes</h4>
              <form>
                <label>Route ID</label>
                <input
                  type="text"
                  name="routeId"
                  value={newRoute.routeId}
                  onChange={handleChange}
                />
                <label>Company ID</label>
                <input
                  type="text"
                  name="companyId"
                  value={newRoute.companyId}
                  onChange={handleChange}
                />
                <label>Route Name</label>
                <input
                  type="text"
                  name="routeName"
                  value={newRoute.routeName}
                  onChange={handleChange}
                />
                <label>Direction</label>
                <select
                  name="direction"
                  value={newRoute.direction}
                  onChange={handleChange}
                >
                  <option value="Forward">Forward</option>
                  <option value="Reverse">Reverse</option>
                </select>
                <label>Water Flow</label>
                <select
                  name="waterFlow"
                  value={newRoute.waterFlow}
                  onChange={handleChange}
                >
                  <option value="Upstream">Upstream</option>
                  <option value="Downstream">Downstream</option>
                </select>

                <button type="button" onClick={handleSave}>Save</button>
                {/* Close Button with SVG */}
                <span className="modal-close" onClick={handleModalClose}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </span>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation Dialog for Add */}
        {confirmationDialogOpen && (
          <div className="confirmation-dialog">
            <div className="confirmation-box">
              <h4>Confirm Add</h4>
              <p>Are you sure you want to add this route?</p>
              <div className="confirmation-buttons">
                <button onClick={() => handleConfirmationClose(false)}>Cancel</button>
                <button onClick={() => handleConfirmationClose(true)}>Yes</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Route Modal */}
        {editModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h4>Edit Route</h4>
              <form>
                <label>Route ID</label>
                <input
                  type="text"
                  name="routeId"
                  value={editRoute.routeId}
                  disabled
                />
                <label>Company ID</label>
                <input
                  type="text"
                  name="companyId"
                  value={editRoute.companyId}
                  onChange={handleEditChange}
                />
                <label>Route Name</label>
                <input
                  type="text"
                  name="routeName"
                  value={editRoute.routeName}
                  onChange={handleEditChange}
                />
                <label>Direction</label>
                <select
                  name="direction"
                  value={editRoute.direction}
                  onChange={handleEditChange}
                >
                  <option value="Forward">Forward</option>
                  <option value="Reverse">Reverse</option>
                </select>
                <label>Water Flow</label>
                <select
                  name="waterFlow"
                  value={editRoute.waterFlow}
                  onChange={handleEditChange}
                >
                  <option value="Upstream">Upstream</option>
                  <option value="Downstream">Downstream</option>
                </select>

                <button type="button" onClick={handleEditSave}>Save</button>
                {/* Close Button with SVG */}
                <span className="modal-close" onClick={handleEditModalClose}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </span>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation Dialog for Edit */}
        {editConfirmationDialogOpen && (
          <div className="confirmation-dialog">
            <div className="confirmation-box">
              <h4>Confirm Edit</h4>
              <p>Are you sure you want to update this route?</p>
              <div className="confirmation-buttons">
                <button onClick={() => handleEditConfirmationClose(false)}>Cancel</button>
                <button onClick={() => handleEditConfirmationClose(true)}>Yes</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmationDialogOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h4>Confirm Delete</h4>
              <p>Are you sure you want to delete this route?</p>
              <div className="confirmation-buttons">
                <button onClick={() => handleDeleteConfirmationClose(false)}>Cancel</button>
                <button onClick={() => handleDeleteConfirmationClose(true)}>Yes</button>
              </div>
            </div>
          </div>
        )}

        {/* Routes Table */}
        <div className="ops-routes-table-wrap">
          <table className="ops-routes-table">
            <thead>
              <tr>
                <th>Route_ID</th>
                <th>Company_ID</th>
                <th>Route Name</th>
                <th>Water Flow</th>
                <th>Direction</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoutes.map((r) => (
                <tr key={r.routeId}>
                  <td>{r.routeId}</td>
                  <td>{r.companyId}</td>
                  <td>{r.routeName}</td>
                  <td>{r.waterFlow}</td>
                  <td>{r.direction}</td>
                  <td className="ops-routes-actions">
                    <button className="ops-routes-action ops-routes-edit" onClick={() => handleEditModalOpen(r.routeId)}>Edit</button>
                    <button className="ops-routes-action ops-routes-delete" onClick={() => handleDeleteOpen(r.routeId)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stations and Routes Section */}
        <h3 className="ops-routes-table-title">Stations and Routes</h3>
        <label className="ops-routes-station-route">
          Route:
          <select value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="Escolta-Kalawaan">Escolta-Kalawaan</option>
            <option value="Kalawaan-Escolta">Kalawaan-Escolta</option>
            <option value="Escolta-Pinagbuhatan">Escolta-Pinagbuhatan</option>
            <option value="Pinagbuhatan-Escolta">Pinagbuhatan-Escolta</option>
          </select>
        </label>

        <div className="ops-routes-toolbar">
          <label className="ops-routes-search">
            <input
              className="ops-routes-search-input"
              type="text"
              placeholder="Search Stations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="ops-routes-add-btn">Add</button>
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
              {filteredStations.map((r) => (
                <tr key={r.routeStationId}>
                  <td>{r.routeStationId}</td>
                  <td>{r.routeId}</td>
                  <td>{r.stationId}</td>
                  <td>{r.stationName}</td>
                  <td>{r.stopOrder}</td>
                  <td className="ops-routes-actions">
                    <button className="ops-routes-action ops-routes-edit">Edit</button>
                    <button className="ops-routes-action ops-routes-delete" onClick={() => handleDeleteStationOpen(r.routeStationId)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}