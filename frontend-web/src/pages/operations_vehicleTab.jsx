import axios from "axios";
import { useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_vehicleTab.css";

export default function VehicleTab() {
  const [type, setType] = useState("Ferry");
  const [capacity, setCapacity] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const token = localStorage.getItem("token");

  // ✅ Auto-fetch existing vehicle on load
  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/api/vehicle/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data) {
          setType(response.data.type);
          setCapacity(response.data.capacity);
        }
      } catch (err) {
        console.error("❌ Error fetching vehicle:", err.response?.data || err.message);
      }
    };

    fetchVehicle();
  }, [token]);

  // Save confirm
  const onSave = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmYes = async () => {
    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/api/vehicle/",
        { vehicleType: type, capacity },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("✅ Saved:", response.data);
      alert("Vehicle saved successfully!");
    } catch (err) {
      console.error("❌ Error saving vehicle:", err.response?.data || err.message);
      alert("Failed to save vehicle. Check console for details.");
    }
    setShowConfirm(false);
  };

  const handleConfirmCancel = () => setShowConfirm(false);

  // ESC to close confirm
  useEffect(() => {
    if (!showConfirm) return;
    const onKey = (e) => e.key === "Escape" && setShowConfirm(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showConfirm]);

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <div className="ops-page">
        <div className="ops-main">
          <h2 className="ops-section">Vehicle</h2>

          <form className="vehicle-form" onSubmit={onSave}>
            <div className="form-row">
              <label htmlFor="vehType">Type of Vehicle</label>
              <select
                id="vehType"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input"
              >
                <option>Ferry</option>
                <option>Roll-on/Roll-off Vessels</option>
                <option>Bus</option>
                <option>Shuttle Vans</option>
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="capacity">Capacity</label>
              <input
                id="capacity"
                type="number"
                min="0"
                className="input"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Enter capacity"
              />
            </div>

            <div className="form-actions">
              <button className="primary-btn" type="submit">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirm dialog — standardized layout */}
      {showConfirm && (
        <div
          className="ops-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-confirm-title"
          onClick={handleConfirmCancel}
        >
          <div
            className="ops-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ops-modalHeader">
              <h3 id="ops-confirm-title" className="ops-modalTitle">
                Save Changes
              </h3>
            </div>

            <div className="ops-modalBody">
              Are you sure you want to save these changes?
            </div>

            <div className="ops-modalFooter">
              <button
                className="ops-btn ops-btnOutline"
                type="button"
                onClick={handleConfirmCancel}
                autoFocus
              >
                Cancel
              </button>
              <button
                className="ops-btn ops-btnNavy"
                type="button"
                onClick={handleConfirmYes}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}