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

  const [notice, setNotice] = useState(null);
  const showNotice = (msg, type = "success") => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 2500);
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [modalVehicleName, setModalVehicleName] = useState("");
  const [modalVehicleType, setModalVehicleType] = useState("Ferry");
  const [modalVehicleCapacity, setModalVehicleCapacity] = useState("");

  // ==========================================================
  // FETCH VEHICLES (wrapped in useCallback → no ESLint warning)
  // ==========================================================
  const fetchVehicles = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiUrl}/api/vehicle/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setVehicles(data);
      if (data.length) setGpsVehicle(data[0].name);
    } catch {
      showNotice("Failed to load vehicles", "error");
    }
  }, [apiUrl, token]);

  // RUN fetchVehicles WHEN apiUrl/token changes
  useEffect(() => {
    if (apiUrl && token) {
      fetchVehicles();
    }
  }, [apiUrl, token, fetchVehicles]);

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
    } catch {
      showNotice("Failed to assign GPS", "error");
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
    } catch {
      showNotice("Error adding vehicle", "error");
    }
  };

  // FILTER SEARCH
  const filteredVehicles = vehicles.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <div className="vehicle-page-container">
        <h2 className="vehicle-title">Vehicle Management</h2>

        <div className="vehicle-layout">
          {/* LEFT BOX */}
          <div className="vehicle-box">
            <div className="vehicle-search-row">
              <input
                className="vehicle-search"
                placeholder="Search vehicle name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button className="blue-btn" onClick={() => setShowAddModal(true)}>
                Add vehicle
              </button>
            </div>

            <div className="vehicle-list-title">Vehicles List</div>

            <table className="vehicle-table">
              <thead>
                <tr>
                  <th>Vehicle Name</th>
                  <th>Type</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.length ? (
                  filteredVehicles.map((v) => (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td>{v.type}</td>
                      <td>{v.capacity}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: "center" }}>
                      No vehicles found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* RIGHT BOX */}
          <div className="vehicle-box">
            <div className="vehicle-list-title">Assign GPS Device</div>

            <div className="gps-pair-row">
              <div className="gps-row">
                <label>Vehicle:</label>
                <select
                  className="input"
                  value={gpsVehicle}
                  onChange={(e) => setGpsVehicle(e.target.value)}
                >
                  <option value="" disabled>Select Vehicle</option>
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
                  <option value="FERRY-001">FERRY-001</option>
                  <option value="FERRY-002">FERRY-002</option>
                </select>
              </div>
            </div>

            <button className="blue-btn center-btn" onClick={handleSaveGPS}>
              Save Assignment
            </button>
          </div>
        </div>

        {notice && (
          <div className={`notice ${notice.type}`}>{notice.msg}</div>
        )}
      </div>

      {showAddModal && (
        <div className="add-modal-overlay" onClick={() => setShowAddModal(false)}>
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
                <option value="Roll-on/Roll-off Vessels">Roll-on/Roll-off Vessels</option>
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

            <button className="blue-btn save-modal-btn" onClick={handleSaveVehicle}>
              Save Vehicle
            </button>
          </div>
        </div>
      )}
    </>
  );
}
