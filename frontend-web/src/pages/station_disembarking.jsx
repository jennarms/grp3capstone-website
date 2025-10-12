import { useEffect, useMemo, useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_disembarking.css";

function MagnifierSVG() {
  return (
    <svg className="dm-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Disembarking() {
  const [tripInfo] = useState({
    route: "Escolta", // Route is hardcoded to "Escolta"
  });

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState(null);

  const [toast, setToast] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);

  // Temporary placeholder data
  useEffect(() => {
    setRows([
      { BD_ID: 25, Booking_ID: "BK000001", User_ID: "UID010", boarding_time: "2025-10-12 16:55:56", disembarking_time: null, status: "B", Qrcode_ID: "QR000001", Schedule_ID: "NoSchedule", origin: "ST0001", destination: "ST0005", departure_date: "2025-10-13", departure_time: "17:00:00" },
      { BD_ID: 26, Booking_ID: "BK000002", User_ID: "UID011", boarding_time: "2025-10-12 16:55:47", disembarking_time: null, status: "B", Qrcode_ID: "QR000002", Schedule_ID: "NoSchedule", origin: "ST0001", destination: "ST0009", departure_date: "2025-10-13", departure_time: "17:00:00" },
      { BD_ID: 27, Booking_ID: "BK000003", User_ID: "UID012", boarding_time: null, disembarking_time: null, status: "P", Qrcode_ID: "QR000003", Schedule_ID: "NoSchedule", origin: "ST0001", destination: "ST0008", departure_date: "2025-10-13", departure_time: "08:15:00" },
    ]);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.Booking_ID, r.User_ID, r.status, r.Qrcode_ID, r.origin, r.destination, r.departure_date, r.departure_time]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [rows, q]);

  const openConfirm = (row) => {
    setTargetRow(row);
    setConfirmOpen(true);
  };

  const confirmYes = () => {
    if (!targetRow) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === targetRow.id ? { ...r, disembarked: true, booking_status: "DI" } : r
      )
    );
    setToast({ title: "Success !", body: `Passenger ${targetRow.id} marked as disembarked.` });
    setTimeout(() => setToast(null), 3000);
    setConfirmOpen(false);
    setTargetRow(null);
  };

  return (
    <div className="dm-shell">
      <StationNavbar />

      <main className="dm-main">
        <h1 className="dm-title">Disembarking Management</h1>
        <LogoutButton />

        {/* Only displaying the route name */}
        <section className="dm-tripcard">
          <div className="dm-tripcard-head">
            <div className="dm-tripcard-route">{tripInfo.route}</div> {/* Display route name */}
          </div>
        </section>

        {/* Scan button */}
        <div className="dm-action-row">
          <button className="dm-scan-btn" onClick={() => setScanOpen(true)}>
            <span className="dm-scan-icon">🧾</span> Scan
          </button>
        </div>

        {/* Passenger List */}
        <div className="dm-list-head">
          <h2 className="dm-list-title">Passenger List</h2>
          <div className="dm-search-wrap">
            <MagnifierSVG />
            <input
              className="dm-search"
              placeholder="Search Passenger"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <section className="dm-table-section">
          <div className="dm-table-frame">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>BD_ID</th>
                  <th>Booking_ID</th>
                  <th>User_ID</th>
                  <th>Boarding Time</th>
                  <th>Disembarking Time</th>
                  <th>Status</th>
                  <th>Qrcode_ID</th>
                  <th>Schedule_ID</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Departure Date</th>
                  <th>Departure Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.BD_ID}>
                    <td>{r.BD_ID}</td>
                    <td>{r.Booking_ID}</td>
                    <td>{r.User_ID}</td>
                    <td>{r.boarding_time || '—'}</td>
                    <td>{r.disembarking_time || '—'}</td>
                    <td>{r.status || '—'}</td>
                    <td>{r.Qrcode_ID || '—'}</td>
                    <td>{r.Schedule_ID || '—'}</td>
                    <td>{r.origin || '—'}</td>
                    <td>{r.destination || '—'}</td>
                    <td>{r.departure_date || '—'}</td>
                    <td>{r.departure_time || '—'}</td>
                    <td>
                      <button
                        className={`dm-pill ${r.disembarked ? "dm-pill--done" : "dm-pill--primary"}`}
                        onClick={() => !r.disembarked && openConfirm(r)}
                        disabled={r.disembarked}
                      >
                        {r.disembarked ? "Disembarked" : "Mark Disembarked"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="dm-empty">No passengers match “{q}”.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Confirm Modal */}
        {confirmOpen && (
          <div className="dm-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="dmConfirmTitle">
            <div className="dm-confirm">
              <div className="dm-confirm-header">
                <span className="dm-qmark">?</span>
                <h3 id="dmConfirmTitle">Disembark Passenger Manually</h3>
              </div>
              <p className="dm-confirm-body">Are you sure you want to manually disembark this passenger?</p>
              <div className="dm-confirm-actions">
                <button className="dm-btn dm-btn-ghost" onClick={() => setConfirmOpen(false)}>Cancel</button>
                <button className="dm-btn dm-btn-warn" onClick={confirmYes}>Yes</button>
              </div>
            </div>
          </div>
        )}

        {/* Scan Modal */}
        {scanOpen && (
          <div className="dm-modal-backdrop">
            <div className="dm-modal">
              <h3>Scan Passenger QR Code</h3>
              <p className="dm-sub">Please place the passenger’s QR code in front of the scanner device.</p>
              <div className="dm-hero-circle">
                📷
              </div>
              <p className="dm-status">Currently scanning...</p>
              <p className="dm-hint">If scanning doesn't work, use manual.</p>
              <div className="dm-modal-actions">
                <button className="dm-btn dm-btn-primary dm-modal-close" onClick={() => setScanOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="dm-toast-wrap">
            <div className="dm-toast">
              <div className="dm-toast-title">{toast.title}</div>
              <div className="dm-toast-body">{toast.body}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
