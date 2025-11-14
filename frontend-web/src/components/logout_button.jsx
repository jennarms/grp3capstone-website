import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./logout_button.css";

export function LogoutButton() {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const openConfirm = () => setShowConfirm(true);
  const closeConfirm = () => setShowConfirm(false);

  const confirmLogout = () => {
    // --- CLEAR LOGIN KEYS ---
    localStorage.removeItem("token");
    localStorage.removeItem("admin_id");
    localStorage.removeItem("role");

    // --- CLEAR BC, ADMIN & BROADCAST KEYS ---
    const keysToRemove = [
      "admin_name",
      "bc:lastOpenAt",
      "bc:lastSeen:admins",
      "bc:lastSeen:everyone",
    ];

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Remove dynamic broadcast:lastSeen:* keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("broadcast:lastSeen:")) {
        localStorage.removeItem(key);
      }
    });

    // 👇 FORCE REACT TO UPDATE & STOP RE-USING OLD LOCALSTORAGE VALUES
    window.dispatchEvent(new Event("storage"));

    // Close modal first (UI update)
    closeConfirm();

    // 👇 FIX: Small delay prevents React components from restoring the old values
    setTimeout(() => {
      // Redirect to login page
      navigate("/", { replace: true });

      // Prevent back navigation
      window.history.pushState(null, "", window.location.href);
      window.onpopstate = () => {
        window.history.pushState(null, "", window.location.href);
      };
    }, 50);
  };

  // Close modal with ESC key
  useEffect(() => {
    if (!showConfirm) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showConfirm]);

  return (
    <>
      {/* Logout button */}
      <div className="logout-btn-fixed">
        <button type="button" className="logout-btn" onClick={openConfirm}>
          Log Out
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="logout-btn-confirm-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && closeConfirm()}
        >
          <div className="logout-btn-confirm-box" role="document">
            <h3 id="logout-title">Log out</h3>
            <p>Are you sure you want to log out?</p>

            <div className="logout-btn-confirm-buttons">
              <button
                type="button"
                className="logout-btn-cancel-btn"
                onClick={closeConfirm}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-btn-yes-btn"
                onClick={confirmLogout}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
