import axios from "axios";
import { useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_vehicleTab.css";

export default function VehicleTab() {
  const [type, setType] = useState("Ferry");
  const [capacity, setCapacity] = useState("");
  const [originalType, setOriginalType] = useState("Ferry"); // Track original type

  // Capacity save confirmation
  const [showCapacityConfirm, setShowCapacityConfirm] = useState(false);

  // Vehicle type change - triple confirmation states
  const [typeChangeStep, setTypeChangeStep] = useState(0); // 0=none, 1=first confirm, 2=type confirm, 3=final confirm
  const [confirmationText, setConfirmationText] = useState("");
  const [finalConfirmationText, setFinalConfirmationText] = useState("");

  // Success/Error notices
  const [notice, setNotice] = useState({ show: false, message: "", type: "success" });

  // Loading states
  const [isLoading, setIsLoading] = useState(false);

  // Use environment variable for API URL
  const apiUrl = import.meta.env.VITE_API_URL;
  console.log("API URL from env:", apiUrl);

  const token = localStorage.getItem("token");

  // Show notice helper
  const showNotice = (message, type = "success") => {
    setNotice({ show: true, message, type });
    setTimeout(() => setNotice({ show: false, message: "", type: "success" }), 3000);
  };

  // ✅ Auto-fetch existing vehicle on load
  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`${apiUrl}/api/vehicle/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data) {
          setType(response.data.type);
          setOriginalType(response.data.type);
          setCapacity(response.data.capacity.toString());
        }
      } catch (err) {
        console.error("❌ Error fetching vehicle:", err.response?.data || err.message);
        if (err.response?.status !== 404) {
          showNotice("Failed to fetch vehicle data", "error");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (apiUrl && token) {
      fetchVehicle();
    }
  }, [token, apiUrl]);

  // ===== CAPACITY SAVE =====
  const handleCapacitySave = (e) => {
    e.preventDefault();
    if (!capacity.trim()) {
      showNotice("Please enter a capacity value", "error");
      return;
    }
    setShowCapacityConfirm(true);
  };

  const handleCapacityConfirmYes = async () => {
    try {
      setIsLoading(true);
      const response = await axios.put(
        `${apiUrl}/api/vehicle/capacity`,
        { capacity: parseInt(capacity) },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("✅ Capacity saved:", response.data);
      showNotice("Vehicle capacity updated successfully!");
    } catch (err) {
      console.error("❌ Error saving capacity:", err.response?.data || err.message);
      showNotice(`Failed to update capacity: ${err.response?.data?.error || err.message}`, "error");
    } finally {
      setIsLoading(false);
      setShowCapacityConfirm(false);
    }
  };

  // ===== VEHICLE TYPE CHANGE - TRIPLE CONFIRMATION =====
  const handleTypeChange = (newType) => {
    setType(newType);

    // If type actually changed from original, start confirmation process
    if (newType !== originalType) {
      setTypeChangeStep(1);
    } else {
      setTypeChangeStep(0);
    }
  };

  const handleTypeSave = (e) => {
    e.preventDefault();

    if (type === originalType) {
      showNotice("No changes to vehicle type");
      return;
    }

    // Start the confirmation process
    setTypeChangeStep(1);
  };

  // Step 1: First confirmation
  const handleFirstConfirm = () => {
    setTypeChangeStep(2);
    setConfirmationText("");
  };

  // Step 2: Type "CONFIRM"
  const handleSecondConfirm = () => {
    if (confirmationText !== "CONFIRM") {
      showNotice("Please type 'CONFIRM' exactly", "error");
      return;
    }
    setTypeChangeStep(3);
    setFinalConfirmationText("");
  };

  // Step 3: Final confirmation with typing "CONFIRM" again
  const handleFinalConfirm = async () => {
    if (finalConfirmationText !== "CONFIRM") {
      showNotice("Please type 'CONFIRM' exactly", "error");
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.put(
        `${apiUrl}/api/vehicle/type`,
        {
          vehicleType: type,
          confirmationCode: finalConfirmationText,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ Vehicle type updated:", response.data);
      setOriginalType(type); // Update original type
      showNotice("Vehicle type updated successfully! Warning: This may have affected related data.");

      // Reset confirmation process
      setTypeChangeStep(0);
      setConfirmationText("");
      setFinalConfirmationText("");
    } catch (err) {
      console.error("❌ Error updating vehicle type:", err.response?.data || err.message);
      showNotice(`Failed to update vehicle type: ${err.response?.data?.error || err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel all confirmations
  const cancelAllConfirmations = () => {
    setShowCapacityConfirm(false);
    setTypeChangeStep(0);
    setConfirmationText("");
    setFinalConfirmationText("");
    setType(originalType); // Reset type to original
  };

  // ESC to close modals
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        cancelAllConfirmations();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [originalType]);

  // 🔒 Prevent page scroll / movement while any modal is open (no layout jump)
  const modalOpen = showCapacityConfirm || typeChangeStep > 0 || notice.show;
  useEffect(() => {
    const body = document.body;

    if (modalOpen) {
      const scrollY = window.scrollY || window.pageYOffset;
      // Freeze the body at the current position
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overscrollBehavior = "contain";
      body.classList.add("ops-modalOpen"); // cosmetic rules
    } else {
      // Restore scroll position exactly
      const top = body.style.top;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overscrollBehavior = "";
      body.classList.remove("ops-modalOpen");
      if (top) {
        const y = -parseInt(top, 10);
        window.scrollTo(0, y);
      }
    }

    return () => {
      // Cleanup in case component unmounts while modal is open
      if (document.body.style.position === "fixed") {
        const top = document.body.style.top;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.overscrollBehavior = "";
        document.body.classList.remove("ops-modalOpen");
        if (top) {
          const y = -parseInt(top, 10);
          window.scrollTo(0, y);
        }
      }
    };
  }, [modalOpen]);

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <div className="ops-page">
        <div className="ops-main">
          <h2 className="ops-section">Vehicle Management</h2>

          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner">Loading...</div>
            </div>
          )}

          {/* Vehicle Type Form */}
          <div className="vehicle-form-section">
            <h3 className="form-section-title"></h3>
            <div className="form-row">
              <label htmlFor="vehType">Type of Vehicle</label>
              <select
                id="vehType"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="input"
                disabled={isLoading}
              >
                <option value="Ferry">Ferry</option>
                <option value="Roll-on/Roll-off Vessels">Roll-on/Roll-off Vessels</option>
                <option value="Bus">Bus</option>
                <option value="Shuttle Vans">Shuttle Vans</option>
              </select>
            </div>

            <div className="form-actions">
              <button
                className={`primary-btn ${type !== originalType ? "btn-warning" : "btn-disabled"}`}
                onClick={handleTypeSave}
                disabled={type === originalType || isLoading}
              >
                {type !== originalType ? "⚠️ Save Type Change (Dangerous)" : "No Changes"}
              </button>
            </div>
          </div>

          {/* Capacity Form */}
          <div className="vehicle-form-section">
            <h3 className="form-section-title"></h3>
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
                disabled={isLoading}
              />
            </div>

            <div className="form-actions">
              <button
                className="primary-btn"
                onClick={handleCapacitySave}
                disabled={isLoading || !capacity.trim()}
              >
                Save Capacity
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Capacity Confirmation */}
      {showCapacityConfirm && (
        <div className="ops-modalOverlay" onClick={() => setShowCapacityConfirm(false)}>
          <div className="ops-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modalHeader">
              <h3 className="ops-modalTitle">Save Capacity Changes</h3>
            </div>
            <div className="ops-modalBody">
              Are you sure you want to update the vehicle capacity to <strong>{capacity}</strong>?
            </div>
            <div className="ops-modalFooter">
              <button
                className="ops-btn ops-btnOutline"
                onClick={() => setShowCapacityConfirm(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="ops-btn ops-btnNavy"
                onClick={handleCapacityConfirmYes}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Capacity"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Type Change - Step 1: First Confirmation */}
      {typeChangeStep === 1 && (
        <div className="ops-modalOverlay" onClick={cancelAllConfirmations}>
          <div className="ops-modal danger-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modalHeader">
              <h3 className="ops-modalTitle">⚠️ Dangerous Operation</h3>
            </div>
            <div className="ops-modalBody">
              <p>
                <strong>WARNING:</strong> Changing the vehicle type is a sensitive operation that may
                delete or corrupt data connected to this vehicle.
              </p>
              <p>
                You are about to change from <strong>"{originalType}"</strong> to{" "}
                <strong>"{type}"</strong>.
              </p>
              <p>Are you absolutely sure you want to continue?</p>
            </div>
            <div className="ops-modalFooter">
              <button className="ops-btn ops-btnOutline" onClick={cancelAllConfirmations}>
                Cancel
              </button>
              <button className="ops-btn ops-btnNavy" onClick={handleFirstConfirm}>
                Yes, I'm Sure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Type Change - Step 2: Type CONFIRM */}
      {typeChangeStep === 2 && (
        <div className="ops-modalOverlay" onClick={cancelAllConfirmations}>
          <div className="ops-modal danger-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modalHeader">
              <h3 className="ops-modalTitle">⚠️ Type Confirmation Required</h3>
            </div>
            <div className="ops-modalBody">
              <p>
                To proceed with this dangerous operation, please type <strong>"CONFIRM"</strong>{" "}
                exactly:
              </p>
              <input
                type="text"
                className="input confirmation-input"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type CONFIRM"
                autoFocus
              />
            </div>
            <div className="ops-modalFooter">
              <button className="ops-btn ops-btnOutline" onClick={cancelAllConfirmations}>
                Cancel
              </button>
              <button
                className="ops-btn ops-btnNavy"
                onClick={handleSecondConfirm}
                disabled={confirmationText !== "CONFIRM"}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Type Change - Step 3: Final Confirmation */}
      {typeChangeStep === 3 && (
        <div className="ops-modalOverlay" onClick={cancelAllConfirmations}>
          <div className="ops-modal danger-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modalHeader">
              <h3 className="ops-modalTitle">🚨 FINAL CONFIRMATION</h3>
            </div>
            <div className="ops-modalBody">
              <p>
                <strong>LAST CHANCE:</strong> This action cannot be undone!
              </p>
              <p>
                Vehicle type will change from <strong>"{originalType}"</strong> to{" "}
                <strong>"{type}"</strong>
              </p>
              <p>
                Type <strong>"CONFIRM"</strong> one more time to proceed:
              </p>
              <input
                type="text"
                className="input confirmation-input"
                value={finalConfirmationText}
                onChange={(e) => setFinalConfirmationText(e.target.value)}
                placeholder="Type CONFIRM"
                autoFocus
              />
            </div>
            <div className="ops-modalFooter">
              <button className="ops-btn ops-btnOutline" onClick={cancelAllConfirmations}>
                Cancel
              </button>
              <button
                className="ops-btn ops-btnNavy"
                onClick={handleFinalConfirm}
                disabled={finalConfirmationText !== "CONFIRM" || isLoading}
              >
                {isLoading ? "Executing..." : "Execute Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Notice */}
      {notice.show && (
        <div
          className="ops-modalOverlay"
          onClick={() => setNotice({ show: false, message: "", type: "success" })}
        >
          <div className="ops-modal notice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modalHeader">
              <h3
                className={`ops-modalTitle ${
                  notice.type === "error" ? "error-title" : "success-title"
                }`}
              >
                {notice.type === "error" ? "❌ Error" : "✅ Success"}
              </h3>
            </div>
            <div className="ops-modalBody">{notice.message}</div>
            <div className="ops-modalFooter">
              <button
                className="ops-btn ops-btnNavy"
                onClick={() => setNotice({ show: false, message: "", type: "success" })}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
