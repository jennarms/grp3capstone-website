import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./feedback.css";

/* --- Utils --- */
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
    <span className="fb-stars" aria-label={`Rating ${value} of ${max}`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < value;
        return (
          <svg
            key={i}
            className={`fb-star ${filled ? "filled" : ""}`}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 17.27l6.18 3.73-1.64-7.03L21.5 9.24l-7.12-.61L12 2 9.62 8.63 2.5 9.24l4.96 4.73L5.82 21z" />
          </svg>
        );
      })}
    </span>
  );
}

/* --- Sample data --- */
const SEED = [
  {
    id: "fb1",
    date: "2025-05-27T16:30:00",
    category: "Complaint",
    station: "Pinagbuhatan",
    rating: 1,
    message:
      "The ferry was delayed and there was no clear announcement. Please improve communication.",
    image:
      "https://images.unsplash.com/photo-1505852679233-d9fd70aff56d?q=80&w=1200&auto=format&fit=crop",
    adminResponse:
      "Thank you for your feedback. We truly appreciate you taking the time to share your experience with us. Your input is important and greatly valued, as it helps us enhance our services. We are committed to continuously improving our procedures to strengthen communication and provide a better overall experience for all our passengers.",
  },
  {
    id: "fb2",
    date: "2025-05-25T12:33:00",
    category: "Complaint",
    station: "—",
    rating: 2,
    message: "—",
    image: "",
    adminResponse: "",
  },
];

export function Feedback() {
  const [items, setItems] = useState(SEED);
  const [filter, setFilter] = useState("all");

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const filtered = useMemo(
    () => items.filter((i) => (filter === "all" ? true : i.category === filter)),
    [items, filter]
  );

  const onDelete = (id) => {
    setPendingDeleteId(id);
    setConfirmDeleteOpen(true);
  };
  const confirmDelete = () => {
    if (pendingDeleteId != null) {
      setItems((prev) => prev.filter((i) => i.id !== pendingDeleteId));
    }
    setConfirmDeleteOpen(false);
    setPendingDeleteId(null);
  };
  const cancelDelete = () => {
    setConfirmDeleteOpen(false);
    setPendingDeleteId(null);
  };

  const onReply = (id) => {
    const text = window.prompt("Write admin reply:");
    if (text == null) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, adminResponse: text } : i))
    );
  };

  return (
    <>
      <Navbar />

      <div className="fb-main">
        {/* HEADER (static) */}
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
    <option value="all">Sort by category</option>
    <option value="Complaint">Complaint</option>
    <option value="Compliment">Compliment</option>
    <option value="Suggestion">Suggestion</option>
    <option value="Inquiry">Inquiry</option>
  </select>

  <Link className="fb-settings" to="/feedbackSettings">
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
  aria-label="Delete"
  onClick={() => onDelete(f.id)}
>
  <svg viewBox="0 0 24 24" className="icon-trash" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
</button>
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

                {f.image ? (
                  <img className="fb-photo" src={f.image} alt="attachment" />
                ) : null}

                {f.adminResponse && (
                  <div className="fb-admin-reply">
                    <b>Admin:</b>{" "}
                    <span className="fb-admin-text">{f.adminResponse}</span>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>

      {/* Delete modal */}
      {confirmDeleteOpen && (
        <div className="modal-overlay" onClick={cancelDelete} aria-hidden="true">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="del-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-title" id="del-title">
                Delete Feedback
              </span>
            </div>
            <div className="modal-body">
              Are you sure you want to delete this feedback? This action cannot
              be undone.
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}