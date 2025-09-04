import React, { useEffect, useState } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import { OperationsTab } from "../components/operationsTab";
import "./operations_vehicleTab.css";

export default function VehicleTab() {
  const [type, setType] = useState("Ferry");
  const [capacity, setCapacity] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Open confirm instead of submitting immediately
  const onSave = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmYes = () => {
    // 👉 plug your API call here
    console.log({ type, capacity });
    setShowConfirm(false);
  };

  const handleConfirmCancel = () => setShowConfirm(false);

  // ESC to close
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
                <option>Bus</option>
                <option>Tram</option>
                <option>Train</option>
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
                placeholder=""
              />
            </div>

            <div className="form-actions">
              <button className="primary-btn" type="submit">Save</button>
            </div>
          </form>
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
          <div
            className="confirm-box"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title">Save Changes</h3>
            <p>Are you sure with this action?</p>

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
                onClick={handleConfirmYes}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}