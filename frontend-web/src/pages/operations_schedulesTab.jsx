import React, { useState, useEffect } from "react";
import { Navbar } from "../components/navBar";  // assuming you have Navbar component
import { HeaderButton } from "../components/headerButton";  // assuming you have HeaderButton component
import { OperationsTab } from "../components/operationsTab";  // assuming you have OperationsTab component
import "./operations_schedulesTab.css";  // the relevant CSS file

export function SchedulesTab() {
  const [schedules, setSchedules] = useState({
    headers: [
      "ESCOLTA", "LAWTON", "QUINTA", "PUP", "STA-ANA", "LAMBINGAN", "VALENZUELA", 
      "HULO", "GUADALUPE", "SAN JOAQUIN", "KALAWAN"
    ],
    data: [
      ["8:15 AM", "8:20 AM", "8:22 AM", "8:40 AM", "8:55 AM", "9:00 AM", "9:10 AM", "9:15 AM", "9:20 AM", "9:35 AM", "9:30 AM"],
      ["9:00 AM", "9:05 AM", "9:07 AM", "9:26 AM", "9:39 AM", "9:42 AM", "9:50 AM", "9:56 AM", "10:00 AM", "10:15 AM", "10:20 AM"],
      // More rows can go here...
    ]
  });

  const [showConfirm, setShowConfirm] = useState(false);

  // Open confirm dialog before saving
  const onSave = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmYes = () => {
    // This is where you'd plug in your API call or logic to save the data
    console.log("Schedules saved", schedules);
    setShowConfirm(false);
  };

  const handleConfirmCancel = () => setShowConfirm(false);

  // ESC to close the confirm dialog
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
          <h2 className="ops-section">Schedules</h2>

          <form className="schedules-form" onSubmit={onSave}>
            <div className="form-row">
              <label htmlFor="scheduleData">Schedule Data</label>
              <textarea
                id="scheduleData"
                className="input"
                value={JSON.stringify(schedules.data, null, 2)} // display the data as JSON for now
                onChange={(e) => {
                  const newSchedules = { ...schedules, data: JSON.parse(e.target.value) };
                  setSchedules(newSchedules);
                }}
                rows={6}
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