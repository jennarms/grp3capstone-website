import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./headerButton.css";

export function HeaderButton({ modalVisible, onLogout = () => {} }) {
  const navigate = useNavigate();

  // Local state for the confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);

  // If a parent passes `modalVisible`, treat it as controlled.
  const isControlled = typeof modalVisible === "boolean";
  const isOpen = isControlled ? modalVisible : showConfirm;

  const goToAccountSettings = () => {
    navigate("/accountSettings");
  };

  const openConfirm = () => {
    if (isControlled) return;      // parent controls visibility
    setShowConfirm(true);
  };
  const closeConfirm = () => {
    if (isControlled) return;
    setShowConfirm(false);
  };

  const confirmLogout = () => {
    // Close local modal first (if uncontrolled), then call parent handler
    closeConfirm();
    onLogout();
  };

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") closeConfirm(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      {/* fixed header actions */}
      <div className="header-buttons-fixed">
        <button
          type="button"
          className="settings-btn"
          onClick={goToAccountSettings}
          aria-label="Account settings"
          title="Account settings"
        >
          <img
            src="https://cdn-icons-png.flaticon.com/512/3524/3524659.png"
            alt="Settings"
            className="settings-icon"
          />
        </button>

        <button
          type="button"
          className="logout-btn"
          onClick={openConfirm}
          aria-haspopup="dialog"
          aria-expanded={isOpen ? "true" : "false"}
        >
          Log Out
        </button>
      </div>

      {/* Overlay + dialog (renders only when open) */}
      {isOpen && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          onClick={(e) => {
            // click outside dialog closes (ignore clicks inside box)
            if (e.target === e.currentTarget) closeConfirm();
          }}
        >
          <div className="confirm-box" role="document">
            <h3 id="logout-title">Log out</h3>
            <p>Are you sure you want to log out?</p>

            <div className="confirm-buttons">
              <button type="button" className="cancel-btn" onClick={closeConfirm}>
                Cancel
              </button>
              <button type="button" className="yes-btn" onClick={confirmLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
