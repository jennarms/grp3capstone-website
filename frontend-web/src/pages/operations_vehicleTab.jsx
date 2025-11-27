import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_vehicleTab.css";

export default function VehicleTab() {
  const apiUrl = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem("token");

  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");

  const [gpsVehicle, setGpsVehicle] = useState("");
  const [gpsDevice, setGpsDevice] = useState("");

  const [gpsAssignments, setGpsAssignments] = useState([]);

  const [notice, setNotice] = useState(null);
  const showNotice = (msg, type = "success") => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 2500);
  };

  // ADD VEHICLE modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalVehicleName, setModalVehicleName] = useState("");
  const [modalVehicleType, setModalVehicleType] = useState("Ferry");
  const [modalVehicleCapacity, setModalVehicleCapacity] = useState("");

  // EDIT VEHICLE modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editVehicleId, setEditVehicleId] = useState("");
  const [editVehicleType, setEditVehicleType] = useState("Ferry");
  const [editVehicleCapacity, setEditVehicleCapacity] = useState("");

  // EDIT GPS ASSIGNMENT modal
  const [showEditGpsModal, setShowEditGpsModal] = useState(false);
  const [editGpsVehicle, setEditGpsVehicle] = useState("");
  const [editOldGpsCode, setEditOldGpsCode] = useState("");
  const [editNewGpsCode, setEditNewGpsCode] = useState("");

  // ==========================================================
  // FETCH VEHICLES
  // ==========================================================
  const fetchVehicles = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiUrl}/api/vehicle/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setVehicles(data);
      if (data.length) {
        const stillExists = data.find((v) => v.name === gpsVehicle);
        setGpsVehicle(stillExists ? gpsVehicle : data[0].name);
      } else {
        setGpsVehicle("");
      }
    } catch {
      showNotice("Failed to load vehicles", "error");
    }
  }, [apiUrl, token, gpsVehicle]);

  // ==========================================================
  // FETCH GPS ASSIGNMENTS
  // ==========================================================
  const fetchGpsAssignments = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiUrl}/api/vehicle/gps/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGpsAssignments(data);
    } catch {
      showNotice("Failed to load GPS assignments", "error");
    }
  }, [apiUrl, token]);

  useEffect(() => {
    if (apiUrl && token) {
      fetchVehicles();
      fetchGpsAssignments();
    }
  }, [apiUrl, token, fetchVehicles, fetchGpsAssignments]);

  // ==========================================================
  // SAVE GPS ASSIGNMENT
  // ==========================================================
  const handleSaveGPS = async () => {
    if (!gpsVehicle || !gpsDevice)
      return showNotice("Please fill all fields", "error");

    try {
      await axios.post(
        `${apiUrl}/api/vehicle/gps/assign`,
        { vehicle: gpsVehicle, gpsCode: gpsDevice },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showNotice("GPS assigned successfully!");
      setGpsDevice("");
      fetchGpsAssignments();
    } catch (err) {
      showNotice(
        err?.response?.data?.error || "Failed to assign GPS",
        "error"
      );
    }
  };

  // ==========================================================
  // ADD VEHICLE
  // ==========================================================
  const handleSaveVehicle = async () => {
    if (!modalVehicleName.trim() || !modalVehicleCapacity.trim())
      return showNotice("Please fill all fields", "error");

    try {
      await axios.post(
        `${apiUrl}/api/vehicle/add`,
        {
          name: modalVehicleName,
          type: modalVehicleType,
          capacity: Number(modalVehicleCapacity),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotice("Vehicle added!");

      setModalVehicleName("");
      setModalVehicleType("Ferry");
      setModalVehicleCapacity("");
      setShowAddModal(false);

      fetchVehicles();
    } catch (err) {
      showNotice(
        err?.response?.data?.error || "Error adding vehicle",
        "error"
      );
    }
  };

  // ==========================================================
  // OPEN EDIT VEHICLE MODAL
  // ==========================================================
  const openEditVehicle = (vehicle) => {
    setEditVehicleId(vehicle.id);
    setEditVehicleType(vehicle.type || "Ferry");
    setEditVehicleCapacity(
      vehicle.capacity !== null && vehicle.capacity !== undefined
        ? String(vehicle.capacity)
        : ""
    );
    setShowEditModal(true);
  };

  // ==========================================================
  // UPDATE VEHICLE
  // ==========================================================
  const handleUpdateVehicle = async () => {
    if (!editVehicleId || !editVehicleCapacity.trim()) {
      return showNotice("Please fill all fields", "error");
    }

    try {
      await axios.put(
        `${apiUrl}/api/vehicle/update/${encodeURIComponent(editVehicleId)}`,
        {
          type: editVehicleType,
          capacity: Number(editVehicleCapacity),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotice("Vehicle updated!");
      setShowEditModal(false);
      fetchVehicles();
    } catch (err) {
      showNotice(
        err?.response?.data?.error || "Error updating vehicle",
        "error"
      );
    }
  };

  // ==========================================================
  // DELETE VEHICLE
  // ==========================================================
  const handleDeleteVehicle = async (id) => {
    const confirmDelete = window.confirm(
      `Delete vehicle "${id}"? This will also delete its GPS assignments.`
    );
    if (!confirmDelete) return;

    try {
      await axios.delete(
        `${apiUrl}/api/vehicle/delete/${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotice("Vehicle deleted!");

      if (gpsVehicle === id) {
        setGpsVehicle("");
      }

      fetchVehicles();
      fetchGpsAssignments();
    } catch (err) {
      showNotice(
        err?.response?.data?.error || "Error deleting vehicle",
        "error"
      );
    }
  };

  // ==========================================================
  // OPEN EDIT GPS ASSIGNMENT MODAL
  // ==========================================================
  const openEditGps = (assignment) => {
    setEditGpsVehicle(assignment.vehicle);
    setEditOldGpsCode(assignment.gpsCode);
    setEditNewGpsCode(assignment.gpsCode);
    setShowEditGpsModal(true);
  };

  // ==========================================================
  // UPDATE GPS ASSIGNMENT
  // ==========================================================
  const handleUpdateGps = async () => {
    if (!editGpsVehicle || !editOldGpsCode || !editNewGpsCode) {
      return showNotice("Please fill all fields", "error");
    }

    try {
      await axios.put(
        `${apiUrl}/api/vehicle/gps/update`,
        {
          vehicle: editGpsVehicle,
          oldGpsCode: editOldGpsCode,
          newGpsCode: editNewGpsCode,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotice("GPS assignment updated!");
      setShowEditGpsModal(false);
      fetchGpsAssignments();
    } catch (err) {
      showNotice(
        err?.response?.data?.error || "Error updating GPS assignment",
        "error"
      );
    }
  };

  // ==========================================================
  // DELETE GPS ASSIGNMENT
  // ==========================================================
  const handleDeleteGps = async (assignment) => {
    const confirmDelete = window.confirm(
      `Remove GPS "${assignment.gpsCode}" from vehicle "${assignment.vehicle}"?`
    );
    if (!confirmDelete) return;

    try {
      await axios.delete(`${apiUrl}/api/vehicle/gps/delete`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          vehicle: assignment.vehicle,
          gpsCode: assignment.gpsCode,
        },
      });

      showNotice("GPS assignment deleted!");
      fetchGpsAssignments();
    } catch (err) {
      showNotice(
        err?.response?.data?.error || "Error deleting GPS assignment",
        "error"
      );
    }
  };

  // FILTER SEARCH FOR VEHICLES
  const filteredVehicles = vehicles.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  // Helper for displaying dates
  const formatDateTime = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <div className="vehicle-page-container">
        <h2 className="vehicle-title">Vehicle Management</h2>

        <div className="vehicle-layout">
          {/* LEFT BOX - VEHICLES LIST */}
          <div className="vehicle-box">
            <div>
              <div className="vehicle-search-row">
                <input
                  className="vehicle-search"
                  placeholder="Search vehicle name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <button
                  className="blue-btn"
                  onClick={() => setShowAddModal(true)}
                >
                  Add vehicle
                </button>
              </div>

              <div className="vehicle-list-title">Vehicles List</div>
            </div>

            {/* scrollable area JUST for the table */}
            <div className="table-scroll vehicle-table-wrapper">
              <table className="vehicle-table">
                <thead>
                  <tr>
                    <th>Vehicle Name</th>
                    <th>Type</th>
                    <th>Capacity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.length ? (
                    filteredVehicles.map((v) => (
                      <tr key={v.id}>
                        <td>{v.name}</td>
                        <td>{v.type}</td>
                        <td>{v.capacity}</td>
                        <td className="vehicle-actions">
                          <button
                            className="blue-btn small-btn"
                            onClick={() => openEditVehicle(v)}
                          >
                            Edit
                          </button>
                          <button
                            className="red-btn small-btn"
                            onClick={() => handleDeleteVehicle(v.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center" }}>
                        No vehicles found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT BOX - GPS ASSIGNMENT + TRACKER TABLE */}
          <div className="vehicle-box">
            <div>
              <div className="vehicle-list-title">Assign GPS Device</div>

              <div className="gps-pair-row">
                <div className="gps-row">
                  <label>Vehicle:</label>
                  <select
                    className="input"
                    value={gpsVehicle}
                    onChange={(e) => setGpsVehicle(e.target.value)}
                  >
                    <option value="" disabled>
                      Select Vehicle
                    </option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="gps-row">
                  <label>GPS Device:</label>
                  <select
                    className="input"
                    value={gpsDevice}
                    onChange={(e) => setGpsDevice(e.target.value)}
                  >
                    <option value="">Select Device</option>
                    {/* TODO: replace with dynamic GPS list if you have it */}
                    <option value="FERRY-001">FERRY-001</option>
                    <option value="FERRY-002">FERRY-002</option>
                  </select>
                </div>
              </div>

              <button className="blue-btn center-btn" onClick={handleSaveGPS}>
                Save Assignment
              </button>

              <div className="vehicle-list-title" style={{ marginTop: "20px" }}>
                GPS Assignments
              </div>
            </div>

            {/* scrollable area (vertical + horizontal) for GPS assignments */}
            <div className="table-scroll gps-table-wrapper">
              <table className="vehicle-table gps-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>GPS Device</th>
                    <th>Active From</th>
                    <th>Active To</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gpsAssignments.length ? (
                    gpsAssignments.map((a, idx) => (
                      <tr key={`${a.vehicle}-${a.gpsCode}-${idx}`}>
                        <td>{a.vehicle}</td>
                        <td>{a.gpsCode}</td>
                        <td>{formatDateTime(a.activeFrom)}</td>
                        <td>{formatDateTime(a.activeTo)}</td>
                        <td className="vehicle-actions">
                          <button
                            className="blue-btn small-btn"
                            onClick={() => openEditGps(a)}
                          >
                            Edit
                          </button>
                          <button
                            className="red-btn small-btn"
                            onClick={() => handleDeleteGps(a)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center" }}>
                        No GPS assignments found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {notice && (
          <div className={`notice ${notice.type}`}>{notice.msg}</div>
        )}
      </div>

      {/* ADD VEHICLE MODAL */}
      {showAddModal && (
        <div
          className="add-modal-overlay"
          onClick={() => setShowAddModal(false)}
        >
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="add-modal-title">Vehicle Details</h2>

            <div className="add-modal-row">
              <label>Vehicle Name:</label>
              <input
                type="text"
                className="modal-input"
                value={modalVehicleName}
                onChange={(e) => setModalVehicleName(e.target.value)}
              />
            </div>

            <div className="add-modal-row">
              <label>Vehicle Type:</label>
              <select
                className="modal-input"
                value={modalVehicleType}
                onChange={(e) => setModalVehicleType(e.target.value)}
              >
                <option value="Ferry">Ferry</option>
                <option value="Bus">Bus</option>
                <option value="Shuttle Vans">Shuttle Vans</option>
                <option value="Roll-on/Roll-off Vessels">
                  Roll-on/Roll-off Vessels
                </option>
              </select>
            </div>

            <div className="add-modal-row">
              <label>Capacity:</label>
              <input
                type="number"
                className="modal-input"
                value={modalVehicleCapacity}
                onChange={(e) => setModalVehicleCapacity(e.target.value)}
              />
            </div>

            <button
              className="blue-btn save-modal-btn"
              onClick={handleSaveVehicle}
            >
              Save Vehicle
            </button>
          </div>
        </div>
      )}

      {/* EDIT VEHICLE MODAL */}
      {showEditModal && (
        <div
          className="add-modal-overlay"
          onClick={() => setShowEditModal(false)}
        >
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="add-modal-title">Edit Vehicle</h2>

            <div className="add-modal-row">
              <label>Vehicle Name:</label>
              <input
                type="text"
                className="modal-input"
                value={editVehicleId}
                disabled
              />
            </div>

            <div className="add-modal-row">
              <label>Vehicle Type:</label>
              <select
                className="modal-input"
                value={editVehicleType}
                onChange={(e) => setEditVehicleType(e.target.value)}
              >
                <option value="Ferry">Ferry</option>
                <option value="Bus">Bus</option>
                <option value="Shuttle Vans">Shuttle Vans</option>
                <option value="Roll-on/Roll-off Vessels">
                  Roll-on/Roll-off Vessels
                </option>
              </select>
            </div>

            <div className="add-modal-row">
              <label>Capacity:</label>
              <input
                type="number"
                className="modal-input"
                value={editVehicleCapacity}
                onChange={(e) => setEditVehicleCapacity(e.target.value)}
              />
            </div>

            <button
              className="blue-btn save-modal-btn"
              onClick={handleUpdateVehicle}
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* EDIT GPS ASSIGNMENT MODAL */}
      {showEditGpsModal && (
        <div
          className="add-modal-overlay"
          onClick={() => setShowEditGpsModal(false)}
        >
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="add-modal-title">Edit GPS Assignment</h2>

            <div className="add-modal-row">
              <label>Vehicle:</label>
              <input
                type="text"
                className="modal-input"
                value={editGpsVehicle}
                disabled
              />
            </div>

            <div className="add-modal-row">
              <label>Current GPS:</label>
              <input
                type="text"
                className="modal-input"
                value={editOldGpsCode}
                disabled
              />
            </div>

            <div className="add-modal-row">
              <label>New GPS Device:</label>
              <select
                className="modal-input"
                value={editNewGpsCode}
                onChange={(e) => setEditNewGpsCode(e.target.value)}
              >
                <option value="">Select Device</option>
                {/* Same dummy options; you can replace with dynamic list */}
                <option value="FERRY-001">FERRY-001</option>
                <option value="FERRY-002">FERRY-002</option>
              </select>
            </div>

            <button
              className="blue-btn save-modal-btn"
              onClick={handleUpdateGps}
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </>
  );
}
