import React, { useState } from 'react';
import './headerButton.css';

export function HeaderButton({ onLogout }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <div className="header-buttons-fixed">
        <button className="settings-btn">
          <img
            src="https://cdn-icons-png.flaticon.com/512/3524/3524659.png"
            alt="Settings"
            className="settings-icon"
          />
        </button>
        <button className="logout-btn" onClick={() => setShowConfirm(true)}>
          Log Out
        </button>
      </div>

      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className="confirm-buttons">
              <button className="cancel-btn" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="yes-btn" onClick={onLogout}>Yes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
