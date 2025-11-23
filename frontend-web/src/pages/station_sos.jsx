// station_sos.jsx

import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import { useSOSStore } from "../sos/SOSContext";
import "./station_sos.css";

const apiUrl = import.meta.env.VITE_API_URL; 

const FILTERS = ["New", "All", "Responding", "Resolved"];

function nowTimeString() {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function StationSOS() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Modal state
  const [pendingId, setPendingId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // "toResponding" | "toResolved"

  // Success modal (after resolved)
  const [showSuccess, setShowSuccess] = useState(false);

  // Loading / error / saving
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const counts = useMemo(() => {
    const c = { All: items.length, New: 0, Responding: 0, Resolved: 0 };
    for (const r of items) {
      if (c[r.status] !== undefined) c[r.status] += 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      const matchesFilter =
        activeFilter === "All" ? true : r.status === activeFilter;
      const matchesQuery =
        !q ||
        r.name?.toLowerCase().includes(q) ||
        r.boardingStation?.toLowerCase().includes(q) ||
        r.route?.toLowerCase().includes(q) ||
        String(r.id).toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [items, activeFilter, query]);

  // Open modal helpers
  const openToResponding = (id) => {
    setPendingId(id);
    setPendingAction("toResponding");
  };
  const openToResolved = (id) => {
    setPendingId(id);
    setPendingAction("toResolved");
  };
  const closeConfirm = () => {
    setPendingId(null);
    setPendingAction(null);
  };

  // =========================
  // Initial load from backend
  // =========================
  const seenRef = useRef(new Set());

  useEffect(() => {
    let isMounted = true;
    const fetchSOS = async () => {
      setLoading(true);
      setError("");
      try {
        // Get JWT token from localStorage - try multiple possible keys
        const token = localStorage.getItem("access_token") 
                   || localStorage.getItem("token")
                   || localStorage.getItem("station_token")
                   || localStorage.getItem("authToken");
        
        console.log("Token found:", token ? "Yes" : "No");
        console.log("Token value:", token);
        
        if (!token) {
          setError("No authentication token found. Please log in again.");
          setLoading(false);
          return;
        }
        
        // FIXED: Added /api prefix and Authorization header
        const res = await axios.get(`${apiUrl}/api/sos/station`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!isMounted) return;
        const fetched = res.data?.items ?? [];
        setItems(fetched);
        seenRef.current = new Set(
          fetched.map((i) => (i.id != null ? String(i.id) : ""))
        );
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to load SOS reports:", err);
        console.error("Error response:", err.response?.data);
        console.error("Error status:", err.response?.status);
        setError("Failed to load SOS reports. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSOS();
    return () => {
      isMounted = false;
    };
  }, []);

  // =========================
  // Confirm handler: call API
  // =========================
  const confirmAction = async () => {
    if (!pendingId || !pendingAction) return;

    const sosId = pendingId;
    const action = pendingAction;

    setUpdatingId(sosId);
    setError("");

    // FIXED: Added /api prefix to match PATCH /api/sos/station/<id>/respond or /resolve
    const endpoint =
      action === "toResponding"
        ? `${apiUrl}/api/sos/station/${sosId}/respond`
        : `${apiUrl}/api/sos/station/${sosId}/resolve`;

    try {
      // Get JWT token from localStorage - try multiple possible keys
      const token = localStorage.getItem("access_token") 
                 || localStorage.getItem("token")
                 || localStorage.getItem("station_token")
                 || localStorage.getItem("authToken");
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        setUpdatingId(null);
        return;
      }
      
      const res = await axios.patch(endpoint, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const updated = res.data?.item;

      if (updated) {
        // Use item returned by backend if present
        setItems((prev) =>
          prev.map((it) =>
            String(it.id) === String(updated.id) ? updated : it
          )
        );
      } else {
        // Fallback: optimistic local update (same logic as original)
        setItems((prev) =>
          prev.map((it) => {
            if (String(it.id) !== String(sosId)) return it;

            if (action === "toResponding" && it.status === "New") {
              return {
                ...it,
                status: "Responding",
                respondingAt: it.respondingAt || nowTimeString(),
              };
            }
            if (action === "toResolved" && it.status === "Responding") {
              return {
                ...it,
                status: "Resolved",
                resolvedAt: nowTimeString(),
              };
            }
            return it;
          })
        );
      }

      if (action === "toResolved") setShowSuccess(true);
      closeConfirm();
    } catch (err) {
      console.error("Failed to update SOS status:", err);
      setError(
        action === "toResponding"
          ? "Failed to mark SOS as Responding. Please try again."
          : "Failed to mark SOS as Resolved. Please try again."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const modalTitle =
    pendingAction === "toResponding"
      ? "Confirm Respond"
      : pendingAction === "toResolved"
      ? "Confirm Resolution"
      : "";

  const modalBody =
    pendingAction === "toResponding"
      ? "Mark this SOS alert as Responding? This indicates you're now attending to the passenger."
      : pendingAction === "toResolved"
      ? "Mark this SOS alert as Resolved? This will complete the ticket and remove the action button."
      : "";

  // =========================
  // Global SOS: prepend a 'New' card
  // =========================
  const { latest } = useSOSStore();

  useEffect(() => {
    if (!latest) return;
    const alertId = (latest.id ?? "").toString();
    if (!alertId || seenRef.current.has(alertId)) return;

    seenRef.current.add(alertId);

    const newItem = {
      id: alertId,
      name: latest.userName || latest.userId || "Unknown Rider",
      time: nowTimeString(),
      boardingStation: latest.boardingStation || "Sta. Ana",
      route: latest.tripRoute || "Sta. Ana → Escolta",
      status: "New",
      _enter: true,
    };

    setItems((prev) => [newItem, ...prev]);

    const t = setTimeout(() => {
      setItems((prev) =>
        prev.map((r) =>
          String(r.id) === String(newItem.id) ? { ...r, _enter: false } : r
        )
      );
    }, 50);
    return () => clearTimeout(t);
  }, [latest]);

  return (
    <div className="station-sos-page">
      <StationNavbar />

      <main className="station-sos-main">
        <header className="station-sos-topbar">
          <div className="station-sos-title">
            <h1>SOS</h1>
          </div>
          <LogoutButton />
        </header>

        <div className="station-sos-toolbar">
          <label className="station-sos-search">
            <span className="station-sos-search-icon" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="16.65"
                  y1="16.65"
                  x2="21"
                  y2="21"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search SOS reports"
            />
          </label>

          <div
            className="station-sos-chips"
            role="tablist"
            aria-label="SOS filters"
          >
            {FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={activeFilter === f}
                className={`station-sos-chip ${
                  activeFilter === f ? "is-active" : ""
                }`}
                onClick={() => setActiveFilter(f)}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="station-sos-error-banner">
            {error}
          </div>
        )}

        <section className="station-sos-list">
          {loading ? (
            <div className="station-sos-empty">Loading SOS reports...</div>
          ) : (
            <>
              {filtered.map((r, i) => (
                <article
                  key={`${r.id}-${i}`}
                  className={`station-sos-card ${
                    r.status === "New"
                      ? "is-new"
                      : r.status === "Responding"
                      ? "is-responding"
                      : "is-resolved"
                  } ${r._enter ? "enter" : ""}`}
                >
                  {/* Left status icon (triangle=new, dot=responding, check=resolved) */}
                  <div className="station-sos-card-icon" aria-hidden>
                    {r.status === "New" && (
                      <span className="station-sos-triangle" title="New">
                        <svg viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
                          />
                        </svg>
                      </span>
                    )}
                    {r.status === "Responding" && (
                      <span
                        className="station-sos-dot"
                        title="Responding"
                      />
                    )}
                    {r.status === "Resolved" && (
                      <span className="station-sos-check" title="Resolved">
                        <svg viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
                          />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Details + centered action */}
                  <div className="station-sos-card-content">
                    <div className="station-sos-details">
                      <div>
                        <span className="station-sos-label">Name:</span>{" "}
                        {r.name}
                      </div>
                      <div>
                        <span className="station-sos-label">Time:</span>{" "}
                        {r.time}
                      </div>
                      <div>
                        <span className="station-sos-label">
                          Boarding Station:
                        </span>{" "}
                        {r.boardingStation}
                      </div>
                      <div>
                        <span className="station-sos-label">Trip Route:</span>{" "}
                        {r.route}
                      </div>
                      <div>
                        <span className="station-sos-label">Ride ID:</span> #
                        {r.id}
                      </div>
                      {r.status === "Responding" && (
                        <div>
                          <span className="station-sos-label">
                            Responding at:
                          </span>{" "}
                          {r.respondingAt ?? "—"}
                        </div>
                      )}
                      {r.status === "Resolved" && (
                        <div>
                          <span className="station-sos-label">
                            Resolved at:
                          </span>{" "}
                          {r.resolvedAt ?? "—"}
                        </div>
                      )}
                    </div>

                    <div className="station-sos-card-action">
                      {r.status === "New" && (
                        <button
                          className="station-sos-pill"
                          onClick={() => openToResponding(r.id)}
                          disabled={updatingId === r.id}
                        >
                          {updatingId === r.id &&
                          pendingAction === "toResponding"
                            ? "Updating..."
                            : "Respond"}
                        </button>
                      )}
                      {r.status === "Responding" && (
                        <button
                          className="station-sos-pill"
                          onClick={() => openToResolved(r.id)}
                          disabled={updatingId === r.id}
                        >
                          {updatingId === r.id &&
                          pendingAction === "toResolved"
                            ? "Updating..."
                            : "Responding"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {filtered.length === 0 && (
                <div className="station-sos-empty">
                  No SOS reports match your filters.
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Confirm modal */}
      {pendingId && (
        <div
          className="station-sos-modal-backdrop"
          role="presentation"
          onClick={closeConfirm}
        >
          <div
            className="station-sos-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="station-sos-modal-title"
            aria-describedby="station-sos-modal-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="station-sos-modal-title"
              className="station-sos-modal-title"
            >
              {modalTitle}
            </h3>
            <p
              id="station-sos-modal-desc"
              className="station-sos-modal-text"
            >
              {modalBody}
            </p>

            <div className="station-sos-modal-actions">
              <button
                className="station-sos-btn station-sos-btn--ghost"
                onClick={closeConfirm}
                disabled={updatingId === pendingId}
              >
                Cancel
              </button>
              <button
                className="station-sos-btn station-sos-btn--navy"
                onClick={confirmAction}
                disabled={updatingId === pendingId}
              >
                {updatingId === pendingId ? "Saving..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal after resolving */}
      {showSuccess && (
        <div
          className="station-sos-modal-backdrop"
          role="presentation"
          onClick={() => setShowSuccess(false)}
        >
          <div
            className="station-sos-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="station-sos-success-title"
            aria-describedby="station-sos-success-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="station-sos-success-row">
              <span className="station-sos-success-icon" aria-hidden>
                🏆
              </span>
              <h3
                id="station-sos-success-title"
                className="station-sos-modal-title"
              >
                Successful
              </h3>
            </div>
            <p
              id="station-sos-success-desc"
              className="station-sos-modal-text"
            >
              SOS marked as Resolved.
            </p>

            <div className="station-sos-modal-actions">
              <button
                className="station-sos-btn station-sos-btn--navy"
                onClick={() => setShowSuccess(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}