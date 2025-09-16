// FeedbackSettings.jsx
import axios from "axios";
import { useEffect, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./feedbackSettings.css";

const apiUrl = import.meta.env.VITE_API_URL;
console.log("API URL from env:", apiUrl);

export function FeedbackSettings() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [backup, setBackup] = useState({ enabled: false, message: "" });

  // Load settings
  useEffect(() => {
    axios
      .get(`${apiUrl}/api/feedback/settings`)
      .then((res) => {
        setEnabled(res.data.enabled);
        setMessage(res.data.message);
        setBackup({ enabled: res.data.enabled, message: res.data.message });
      })
      .catch((err) => console.error("Failed to load settings:", err));
  }, []);

  // Save settings
  const onSave = () => {
    axios
      .put(`${apiUrl}/api/feedback/settings`, { enabled, message })
      .then(() => {
        setBackup({ enabled, message }); // keep the latest saved values
        setEditing(false);
      })
      .catch((err) => console.error("Failed to update settings:", err));
  };

  // Cancel editing
  const onCancel = () => {
    setEnabled(backup.enabled);
    setMessage(backup.message);
    setEditing(false);
  };

  return (
    <>
      <Navbar />

      <div className="fs-main">
        <div className="fs-header-row">
          <div className="fs-title-wrap">
            <svg className="fs-title-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12c2.761 0 5-2.239 5-5S14.761 2 12 2 7 4.239 7 7s2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v1h14v-1c0-2.761-3.134-5-7-5z" />
            </svg>
            <h1 className="fs-title">Feedback</h1>
          </div>
          <HeaderButton />
        </div>

        <hr className="fs-title-rule" />

        <h2 className="fs-h2">Settings</h2>

        {/* Status row */}
        <label className="fs-row fs-status">
          <span className="fs-label">Auto-Response Status</span>
          <input
            type="checkbox"
            className="fs-check"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={!editing} // ✅ only editable in edit mode
            aria-label="Enable auto-response"
          />
        </label>

        {/* Message */}
        <div className="fs-row">
          <span className="fs-label">Auto-Response Message</span>
          <div className="fs-textarea-shell">
            <textarea
              className="fs-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              readOnly={!editing} // ✅ lock when not editing
              rows={6}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="fs-actions">
          {editing ? (
            <>
              <button type="button" className="fs-btn fs-btn-dark" onClick={onSave}>
                Save
              </button>
              <button type="button" className="fs-btn fs-btn-light" onClick={onCancel}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="fs-btn fs-btn-dark"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </>
  );
}
