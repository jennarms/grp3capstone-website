import { useMemo, useState } from "react";
import { StationNavbar } from "../components/station_navbar";
import { LogoutButton } from "../components/logout_button";
import "./station_sos.css";

/** Seed data (red=New, yellow=Responding, green=Resolved) */
const DATA = [
  {
    id: "0241",
    name: "Juan Dela Cruz",
    time: "3:42 PM",
    boardingStation: "Sta. Ana",
    route: "Sta. Ana → Escolta",
    status: "New", // red card + Respond button
  },
  {
    id: "0231",
    name: "Jin Dela Cruz",
    time: "6:42 PM",
    boardingStation: "Sta. Ana",
    route: "Sta. Ana → Escolta",
    status: "Responding", // yellow card + Responding button
    respondingAt: "6:50 PM",
  },
  {
    id: "0256",
    name: "Paolo Reyes",
    time: "1:00 PM",
    boardingStation: "Pinagbuhatan Station",
    route: "Pinagbuhatan → Sta. Ana",
    status: "New",
  },
  {
    id: "0257",
    name: "Mae Trinidad",
    time: "7:42 AM",
    boardingStation: "Guadalupe Station",
    route: "Guadalupe → Escolta",
    status: "Resolved", // green card — no button
    resolvedAt: "10:00 AM",
  },
];

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
  const [items, setItems] = useState(DATA);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Modal state
  const [pendingId, setPendingId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // "toResponding" | "toResolved"

  // Success modal (after resolved)
  const [showSuccess, setShowSuccess] = useState(false);

  const counts = useMemo(() => {
    const c = { All: items.length, New: 0, Responding: 0, Resolved: 0 };
    for (const r of items) c[r.status] += 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      const matchesFilter = activeFilter === "All" ? true : r.status === activeFilter;
      const matchesQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.boardingStation.toLowerCase().includes(q) ||
        r.route.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [items, activeFilter, query]);

  // Open modal helpers
  const openToResponding = (id) => { setPendingId(id); setPendingAction("toResponding"); };
  const openToResolved   = (id) => { setPendingId(id); setPendingAction("toResolved");   };
  const closeConfirm     = () => { setPendingId(null); setPendingAction(null); };

  // Confirm handler: apply transition
  const confirmAction = () => {
    if (!pendingId || !pendingAction) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== pendingId) return it;

        if (pendingAction === "toResponding" && it.status === "New") {
          return { ...it, status: "Responding", respondingAt: it.respondingAt || nowTimeString() };
        }
        if (pendingAction === "toResolved" && it.status === "Responding") {
          return { ...it, status: "Resolved", resolvedAt: nowTimeString() };
        }
        return it;
      })
    );

    // If we just resolved, pop success modal
    if (pendingAction === "toResolved") {
      setShowSuccess(true);
    }

    closeConfirm();
  };

  // Text for confirm modal
  const modalTitle =
    pendingAction === "toResponding" ? "Confirm Respond" :
    pendingAction === "toResolved"   ? "Confirm Resolution" : "";

  const modalBody =
    pendingAction === "toResponding"
      ? "Mark this SOS alert as Responding? This indicates you’re now attending to the passenger."
      : pendingAction === "toResolved"
      ? "Mark this SOS alert as Resolved? This will complete the ticket and remove the action button."
      : "";

  return (
    <div className="sos-page">
      <StationNavbar />

      <main className="sos-main">
        <header className="sos-topbar">
          <div className="sos-title">
            <h1>SOS</h1>
          </div>
          <LogoutButton />
        </header>

        <div className="sos-toolbar">
          <label className="sos-search">
            <span className="sos-search-icon" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

          <div className="sos-chips" role="tablist" aria-label="SOS filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={activeFilter === f}
                className={`sos-chip ${activeFilter === f ? "is-active" : ""}`}
                onClick={() => setActiveFilter(f)}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
        </div>

        <section className="sos-list">
          {filtered.map((r, i) => (
            <article
              key={`${r.id}-${i}`}
              className={`sos-card ${
                r.status === "Responding" ? "is-new" :      /* yellow for Responding */
                r.status === "New" ? "is-responding" :     /* red for New */
                "is-resolved"                               /* green for Resolved */
              }`}
            >
              {/* Left status icon (triangle=new, dot=responding, check=resolved) */}
              <div className="sos-card-icon" aria-hidden>
                {r.status === "New" && (
                  <span className="sos-triangle" title="New">
                    <svg viewBox="0 0 24 24">
                      <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </span>
                )}
                {r.status === "Responding" && <span className="sos-dot" title="Responding" />}
                {r.status === "Resolved" && (
                  <span className="sos-check" title="Resolved">
                    <svg viewBox="0 0 24 24">
                      <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
                    </svg>
                  </span>
                )}
              </div>

              {/* Details + centered action */}
              <div className="sos-card-content">
                <div className="sos-details">
                  <div><span className="sos-label">Name:</span> {r.name}</div>
                  <div><span className="sos-label">Time:</span> {r.time}</div>
                  <div><span className="sos-label">Boarding Station:</span> {r.boardingStation}</div>
                  <div><span className="sos-label">Trip Route:</span> {r.route}</div>
                  <div><span className="sos-label">Ride ID:</span> #{r.id}</div>
                  {r.status === "Responding" && (
                    <div><span className="sos-label">Responding at:</span> {r.respondingAt ?? "—"}</div>
                  )}
                  {r.status === "Resolved" && (
                    <div><span className="sos-label">Resolved at:</span> {r.resolvedAt ?? "—"}</div>
                  )}
                </div>

                <div className="sos-card-action">
                  {r.status === "New" && (
                    <button className="sos-pill" onClick={() => openToResponding(r.id)}>
                      Respond
                    </button>
                  )}
                  {r.status === "Responding" && (
                    <button className="sos-pill" onClick={() => openToResolved(r.id)}>
                      Responding
                    </button>
                  )}
                  {/* Resolved: no button */}
                </div>
              </div>
            </article>
          ))}

          {filtered.length === 0 && <div className="sos-empty">No SOS reports match your filters.</div>}
        </section>
      </main>

      {/* Confirm modal (navy buttons, uniform style) */}
      {pendingId && (
        <div className="sos-modal-backdrop" role="presentation" onClick={closeConfirm}>
          <div
            className="sos-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sos-modal-title"
            aria-describedby="sos-modal-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="sos-modal-title" className="sos-modal-title">{modalTitle}</h3>
            <p id="sos-modal-desc" className="sos-modal-text">{modalBody}</p>

            <div className="sos-modal-actions">
              <button className="sos-btn sos-btn--ghost" onClick={closeConfirm}>Cancel</button>
              <button className="sos-btn sos-btn--navy" onClick={confirmAction}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal after resolving */}
      {showSuccess && (
        <div className="sos-modal-backdrop" role="presentation" onClick={() => setShowSuccess(false)}>
          <div
            className="sos-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sos-success-title"
            aria-describedby="sos-success-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sos-success-row">
              <span className="sos-success-icon" aria-hidden>🏆</span>
              <h3 id="sos-success-title" className="sos-modal-title">Successful</h3>
            </div>
            <p id="sos-success-desc" className="sos-modal-text">SOS marked as Resolved.</p>

            <div className="sos-modal-actions">
              <button className="sos-btn sos-btn--navy" onClick={() => setShowSuccess(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
