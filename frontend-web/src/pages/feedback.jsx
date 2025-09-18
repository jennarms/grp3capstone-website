import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./feedback.css";

const apiUrl = import.meta.env.VITE_API_URL;
console.log("API URL from env:", apiUrl);

const fmtDate = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function Stars({ value = 0, max = 5 }) {
  return (
    <span className="fb-stars">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          className={`fb-star ${i < value ? "filled" : ""}`}
          viewBox="0 0 24 24"
        >
          <path d="M12 17.27l6.18 3.73-1.64-7.03L21.5 9.24l-7.12-.61L12 2 9.62 8.63 2.5 9.24l4.96 4.73L5.82 21z" />
        </svg>
      ))}
    </span>
  );
}

export function Feedback() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [settings, setSettings] = useState({ enabled: false, message: "" });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // 🔹 Fetch feedback + settings
  useEffect(() => {
    axios
      .get(`${apiUrl}/api/feedback/`)
      .then((res) => {
        setItems(
          res.data.map((f) => ({
            id: f.id || f.feedback_id,
            date: f.date || f.datetime,
            category: f.category,
            station: f.station,
            rating: f.rating,
            message: f.message,
            image: f.image,
            adminResponse: f.adminResponse || f.admin_response,
          }))
        );
      })
      .catch((err) => console.error("Failed to load feedback:", err));

    axios
      .get(`${apiUrl}/api/feedback/settings`)
      .then((res) => {
        setSettings({
          enabled: res.data.enabled,
          message: res.data.message,
        });
      })
      .catch((err) => console.error("Failed to load settings:", err));
  }, []);

  // 🔹 Filter by category
  const filtered = useMemo(
    () => items.filter((i) => (filter === "all" ? true : i.category === filter)),
    [items, filter]
  );

  // 🔹 Delete flow
  const onDelete = (id) => {
    setPendingDeleteId(id);
    setConfirmDeleteOpen(true);
  };
  const confirmDelete = () => {
    if (pendingDeleteId != null) {
      axios
        .delete(`${apiUrl}/api/feedback/${pendingDeleteId}`)
        .then(() =>
          setItems((prev) => prev.filter((i) => i.id !== pendingDeleteId))
        )
        .catch((err) => console.error("Delete failed:", err));
    }
    setConfirmDeleteOpen(false);
    setPendingDeleteId(null);
  };
  const cancelDelete = () => {
    setConfirmDeleteOpen(false);
    setPendingDeleteId(null);
  };

  // 🔹 Reply (left intact; button removed per your request)
  const onReply = (id) => {
    const text = window.prompt("Write admin reply:");
    if (!text) return;
    axios
      .put(`${apiUrl}/api/feedback/${id}/reply`, { reply: text })
      .then(() =>
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, adminResponse: text } : i))
        )
      )
      .catch((err) => console.error("Reply failed:", err));
  };

  return (
    <>
      <Navbar />
      <div className="fb-main">
        <div className="fb-header">
          <div className="header-row">
            <h1 className="page-title">Feedback</h1>
            <HeaderButton />
          </div>
          <div className="fb-controls-row">
            <select
              className="fb-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Sort by category"
            >
              <option value="all">All categories</option>
              <option value="Complaint">Complaint</option>
              <option value="Compliment">Compliment</option>
              <option value="Suggestion">Suggestion</option>
              <option value="Inquiry">Inquiry</option>
            </select>

            <Link className="fb-settings" to="/feedback/settings">
              Settings
            </Link>
          </div>
          <hr className="fb-title-rule" />
        </div>

        <div className="fb-scroll">
          {filtered.length === 0 ? (
            <div className="fb-empty">
              <div className="fb-empty-title">No feedback yet</div>
              <div className="fb-empty-sub">
                New submissions will appear here. You can still adjust{" "}
                <Link to="/feedbackSettings">Settings</Link> anytime.
              </div>
            </div>
          ) : (
            filtered.map((f) => (
              <article key={f.id} className="fb-card">
                <div className="fb-actions">
                  <button
                    className="icon-btn danger"
                    title="Delete"
                    aria-label={`Delete feedback ${f.id}`}
                    onClick={() => onDelete(f.id)}
                  >
                    {/* SVG trash icon */}
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>

                  {/* Reply button removed per request */}
                </div>

                <div className="fb-row">
                  <span className="fb-label">Date: </span>
                  <span className="fb-value">{fmtDate(f.date)}</span>
                </div>
                <hr className="fb-rule" />
                <div className="fb-grid">
                  <div className="fb-fields">
                    <div className="fb-row">
                      <span className="fb-label">Category: </span>
                      <span className="fb-value">{f.category}</span>
                    </div>
                    <div className="fb-row">
                      <span className="fb-label">Station: </span>
                      <span className="fb-value">{f.station}</span>
                    </div>
                    <div className="fb-row">
                      <span className="fb-label">Rating: </span>
                      <Stars value={f.rating} />
                    </div>
                    <div className="fb-row">
                      <span className="fb-label">Message: </span>
                      <span className="fb-value">{f.message}</span>
                    </div>
                  </div>
                </div>
                {f.image && (
                  <img className="fb-photo" src={f.image} alt="attachment" />
                )}

                {f.adminResponse ? (
                  <div className="fb-admin-reply">
                    <b>Admin:</b> {f.adminResponse}
                  </div>
                ) : settings.enabled ? (
                  <div className="fb-admin-reply">
                    <b>Admin (Auto):</b> {settings.message}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>

      {/* Delete modal */}
      {confirmDeleteOpen && (
        <div
          className="fb-modal-overlay"
          onClick={cancelDelete}
          aria-hidden="true"
        >
          <div
            className="fb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="del-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fb-modal-header">
              <span className="fb-modal-title" id="del-title">
                Delete Feedback
              </span>
            </div>
            <div className="fb-modal-body">
              Are you sure you want to delete this feedback? This action cannot
              be undone.
            </div>
            <div className="fb-modal-actions">
              <button className="fb-btn fb-btn-outline" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="fb-btn fb-btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}