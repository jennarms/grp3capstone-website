import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./logout_button.css"; // Keep this if necessary, or comment out to debug

export function LogoutButton() {
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

    // 3. Redirect to login page, and prevent going back to previous page
    navigate("/", { replace: true });

    // 4. Use window.history.pushState to prevent going back
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => {
      window.history.pushState(null, "", window.location.href); // Prevent going back to the previous page
    };
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

  return (
    <>
      {/* Logout button */}
      <div className="logout-btn-fixed">
        <button
          type="button"
          className="logout-btn"
          onClick={openConfirm}
        >
          Log Out
        </button>
      </div>

      {/* Temporarily removed modal */}
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
              <button type="button" className="logout-btn-cancel-btn" onClick={closeConfirm}>
                Cancel
              </button>
              <button type="button" className="logout-btn-yes-btn" onClick={confirmLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
