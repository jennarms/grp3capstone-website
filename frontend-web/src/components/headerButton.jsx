import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./headerButton.css";

export function HeaderButton() {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const openConfirm = () => setShowConfirm(true);
  const closeConfirm = () => setShowConfirm(false);

  const confirmLogout = () => {
    // 1. Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("admin_id");
    localStorage.removeItem("role");

    // 2. Close modal
    closeConfirm();

    // 3. Redirect to login page (your login route is '/')
    navigate("/");
  };

  // Close modal on ESC key
  useEffect(() => {
    if (!showConfirm) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showConfirm]);

  const goToAccountSettings = () => {
    navigate("/accountSettings");
  };

  return (
    <>
      {/* Header buttons */}
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
          aria-expanded={showConfirm ? "true" : "false"}
        >
          Log Out
        </button>
      </div>

      {/* Logout confirmation modal */}
      {showConfirm && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          onClick={(e) => e.target === e.currentTarget && closeConfirm()}
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
