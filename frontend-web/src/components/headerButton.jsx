import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./headerButton.css";

export function HeaderButton() {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const openConfirm = () => setShowConfirm(true);
  const closeConfirm = () => setShowConfirm(false);

  const confirmLogout = () => {
    // --- CLEAR LOGIN KEYS ---
    localStorage.removeItem("token");
    localStorage.removeItem("admin_id");
    localStorage.removeItem("role");

    // --- CLEAR ADMIN + BC + BROADCAST KEYS ---
    const keysToRemove = [
      "admin_name",
      "bc:lastOpenAt",
      "bc:lastSeen:admins",
      "bc:lastSeen:everyone",
    ];

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Remove ALL "broadcast:lastSeen:*"
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("broadcast:lastSeen:")) {
        localStorage.removeItem(key);
      }
    });

    // 👇 IMPORTANT: Force React to re-evaluate localStorage immediately
    window.dispatchEvent(new Event("storage"));

    // Close modal first
    closeConfirm();

    // 👇 Delay navigation slightly so React cannot repopulate values
    setTimeout(() => {
      navigate("/", { replace: true });

      // Prevent back navigation
      window.history.pushState(null, "", window.location.href);
      window.onpopstate = () => {
        window.history.pushState(null, "", window.location.href);
      };
    }, 50); // <-- fixes the double logout issue
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
      <div className="header-btn-fixed">
        <button
          type="button"
          className="header-btn-settings"
          onClick={goToAccountSettings}
          aria-label="Account settings"
          title="Account settings"
        >
          <img
            src="https://cdn-icons-png.flaticon.com/512/3524/3524659.png"
            alt="Settings"
            className="header-btn-settings-icon"
          />
        </button>

        <button
          type="button"
          className="header-btn-logout"
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
          className="header-btn-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          onClick={(e) => e.target === e.currentTarget && closeConfirm()}
        >
          <div className="header-btn-confirm-box" role="document">
            <h3 id="logout-title">Log out</h3>
            <p>Are you sure you want to log out?</p>

            <div className="header-btn-confirm-buttons">
              <button type="button" className="header-btn-cancel-btn" onClick={closeConfirm}>
                Cancel
              </button>
              <button type="button" className="header-btn-yes-btn" onClick={confirmLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
