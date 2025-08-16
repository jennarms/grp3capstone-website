import { useMemo, useState } from "react";
import { Link } from "react-router-dom";        // ⬅️ add this
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

  // State for delete confirmation modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const filtered = useMemo(
    () => items.filter((i) => (filter === "all" ? true : i.category === filter)),
    [items, filter]
  );

  const onDelete = (id) => {
    setPendingDeleteId(id); // Set the id for the feedback to be deleted
    setConfirmDeleteOpen(true); // Open the confirmation modal
  };

  const confirmDelete = () => {
    if (pendingDeleteId != null) {
      setItems((prev) => prev.filter((i) => i.id !== pendingDeleteId)); // Remove the feedback
    }
    setConfirmDeleteOpen(false); // Close the confirmation modal
    setPendingDeleteId(null); // Reset the pending delete id
  };

  const cancelDelete = () => {
    setConfirmDeleteOpen(false); // Close the confirmation modal without deleting
    setPendingDeleteId(null); // Reset the pending delete id
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
        {/* Sticky header + controls */}
        <div className="fb-sticky">
          <div className="fb-header-row">
            <div className="fb-title">Feedback</div>
            <HeaderButton />
          </div>

          {/* Filter + Settings on ONE line */}
          <div className="fb-controls">
            <select
              className="fb-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Sort by category</option>
              <option value="Complaint">Complaint</option>
              <option value="Compliment">Compliment</option>
              <option value="Suggestion">Suggestion</option>
              <option value="Inquiry">Inquiry</option>
            </select>

            {/* ⬇️ now routes to /feedback/settings */}
            <Link className="fb-settings" to="/feedbackSettings">
              Settings
            </Link>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="fb-list">
          {filtered.map((f) => (
            <article key={f.id} className="fb-card">
              {/* actions */}
              <div className="fb-actions">
                <button
                  className="icon-btn"
                  title="Reply"
                  onClick={() => onReply(f.id)}
                >
                  {/* paper airplane */}
                  <svg viewBox="0 0 24 24">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                  </svg>
                </button>
                <button
                  className="icon-btn danger"
                  title="Delete"
                  onClick={() => onDelete(f.id)} // Open delete confirmation modal
                >
                  {/* trash */}
                  <svg viewBox="0 0 24 24">
                    <path d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9z" />
                  </svg>
                </button>
              </div>

              {/* top fields */}
              <div className="fb-row">
                <span className="fb-label">Date:</span>
                <span className="fb-value">{fmtDate(f.date)}</span>
              </div>
              <hr className="fb-rule" />

              {/* details (text only) */}
              <div className="fb-grid">
                <div className="fb-fields">
                  <div className="fb-row">
                    <span className="fb-label">Category:</span>
                    <span className="fb-value">{f.category}</span>
                  </div>
                  <div className="fb-row">
                    <span className="fb-label">Station:</span>
                    <span className="fb-value">{f.station}</span>
                  </div>
                  <div className="fb-row">
                    <span className="fb-label">Rating:</span>
                    <Stars value={f.rating} />
                  </div>
                  <div className="fb-row">
                    <span className="fb-label">Message:</span>
                    <span className="fb-value">{f.message}</span>
                  </div>
                </div>
              </div>

              {/* photo below the message */}
              {f.image ? (
                <img className="fb-photo" src={f.image} alt="attachment" />
              ) : null}

              {/* admin reply (if any) */}
              {f.adminResponse && (
                <div className="fb-admin-reply">
                  <b>Admin:</b>{" "}
                  <span className="fb-admin-text">{f.adminResponse}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      {/* Confirm Delete Modal */}
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
              <span className="modal-title" id="del-title">Delete Feedback</span>
            </div>
            <div className="modal-body">
              Are you sure you want to delete this feedback? This action cannot be undone.
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={cancelDelete}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}