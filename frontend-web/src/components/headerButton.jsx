import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./headerButton.css";

export function HeaderButton({ modalVisible = false, onLogout = () => {} }) {
  const navigate = useNavigate();

  const goToAccountSettings = () => {
    // Adjust the route if your router uses a different path
    navigate("/accountSettings");
  };

  return (
    <>
      {/* Dark overlay when modal is active */}
      {modalVisible && <div className="dark-overlay"></div>}

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
          onClick={() => setShowConfirm(true)}
        >
          Log Out
        </button>
      </div>

      {modalVisible && (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <div className="confirm-box">
            <h3>Delete Announcement</h3>
            <p>Are you sure you want to delete this announcement? This action cannot be undone.</p>
            <div className="confirm-buttons">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button type="button" className="yes-btn" onClick={onLogout}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}