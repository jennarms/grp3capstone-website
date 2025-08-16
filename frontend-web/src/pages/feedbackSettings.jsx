import { useEffect, useState } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import "./feedbackSettings.css";

const LS_KEY = "fb:autoResponse";

export function FeedbackSettings() {
  const [enabled, setEnabled] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState(
    "Thank you for your feedback. We truly appreciate you taking the time to share your experience with us. Your input is important and greatly valued, as it helps us enhance our services. We are committed to continuously improving our procedures to strengthen communication and provide a better overall experience for all our passengers."
  );

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed.enabled === "boolean") setEnabled(parsed.enabled);
      if (typeof parsed.message === "string") setMessage(parsed.message);
    } catch {}
  }, []);

  const onSave = () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ enabled, message }));
    setEditing(false);
  };

  return (
    <>
      <Navbar />

      <div className="fs-main">
        {/* Title row (icon + label) */}
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
              readOnly={!editing}
              rows={6}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="fs-actions">
          <button
            type="button"
            className="fs-btn fs-btn-dark"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancel" : "Edit"}
          </button>

          <button
            type="button"
            className={`fs-btn fs-btn-dark ${editing ? "" : "fs-disabled"}`}
            onClick={onSave}
            disabled={!editing}
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}