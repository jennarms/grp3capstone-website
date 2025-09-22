import { useEffect, useMemo, useState } from "react";
import { StationNavbar } from "../components/station_navbar";
import { LogoutButton } from "../components/logout_button";
import "./station_disembarking.css";

function MagnifierSVG() {
  return (
    <svg className="dm-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="16.65" y1="16.65" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function LocationPinSVG() {
  return (
    <span className="dm-pin" aria-label="Current stop" title="Current stop">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2c-3.314 0-6 2.686-6 6 0 4.418 5.03 10.246 5.246 10.5a1 1 0 0 0 1.508 0C12.97 18.246 18 12.418 18 8c0-3.314-2.686-6-6-6zm0 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
      </svg>
    </span>
  );
}

export function Disembarking() {
  const [tripInfo] = useState({
    route: "PUP → Kalawaan",
    departTime: "8:40 AM",
    booked: { count: 6, capacity: 30 },
    stops: [
      { name: "Quinta", time: "8:22 AM", status: "Departed" },
      { name: "PUP", time: "8:40 AM", status: "Arrived", pin: true },
      { name: "Sta - Ana", time: "8:55 AM", status: "Approaching" },
      { name: "Lambingan", time: "9:00 AM", status: "Approaching" },
    ],
  });

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState(null);

  const [toast, setToast] = useState(null);
  const [scanOpen, setScanOpen] = useState(false); // 🔹 new state

  useEffect(() => {
    setRows([
      { id: 1, payment_status: "P", payment_amount: 45.0, paid_at: "8:00 am", booking_status: "OB", booking_source: "MA", disembarked: false },
      { id: 2, payment_status: "P", payment_amount: 30.0, paid_at: "8:00 am", booking_status: "OB", booking_source: "MA", disembarked: false },
      { id: 3, payment_status: "P", payment_amount: 40.0, paid_at: "8:10 am", booking_status: "OB", booking_source: "CB", disembarked: false },
      { id: 4, payment_status: "P", payment_amount: 45.0, paid_at: "8:10 am", booking_status: "OB", booking_source: "MA", disembarked: false },
      { id: 5, payment_status: "PG", payment_amount: 38.0, paid_at: "8:38 am", booking_status: "OB", booking_source: "CB", disembarked: false },
      { id: 6, payment_status: "PG", payment_amount: 20.0, paid_at: "8:40 am", booking_status: "OB", booking_source: "GM", disembarked: false },
      { id: 7, payment_status: "F", payment_amount: 0.0, paid_at: "8:42 am", booking_status: "CA", booking_source: "MA", disembarked: false },
      { id: 8, payment_status: "P", payment_amount: 30.0, paid_at: "8:00 am", booking_status: "DI", booking_source: "MB", disembarked: true },
    ]);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.payment_status, r.payment_amount, r.paid_at, r.booking_status, r.booking_source, r.disembarked ? "disembarked" : ""]
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

        {/* Trip Header */}
        <section className="dm-tripcard">
          <div className="dm-tripcard-head">
            <div className="dm-tripcard-route">{tripInfo.route}</div>
            <div className="dm-tripcard-time">{tripInfo.departTime}</div>
            <div className="dm-tripcard-booked">
              Booked: <strong>{tripInfo.booked.count}/{tripInfo.booked.capacity}</strong>
            </div>
          </div>
          <div className="dm-tripcard-divider" />
          <div className="dm-tripcard-body">
            {tripInfo.stops.map((s, i) => (
              <div className="dm-stoprow" key={i}>
                <div className="dm-stopname">{s.pin ? <LocationPinSVG /> : null}{s.name}</div>
                <div className="dm-stoptime">{s.time}</div>
                <div className="dm-stopstatus">{s.status}</div>
              </div>
            ))}
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
                  <th>payment_status</th>
                  <th>payment_amount</th>
                  <th>paid_at</th>
                  <th>booking_status</th>
                  <th>booking_source</th>
                  <th>action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.payment_status}</td>
                    <td>{r.payment_amount.toFixed(2)}</td>
                    <td>{r.paid_at}</td>
                    <td>
                      <span
                        className={`dm-status ${
                          r.booking_status === "OB"
                            ? "dm-status--ok"
                            : r.booking_status === "CA"
                            ? "dm-status--bad"
                            : r.booking_status === "DI"
                            ? "dm-status--warn"
                            : ""
                        }`}
                      >
                        {r.booking_status}
                      </span>
                    </td>
                    <td>{r.booking_source}</td>
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
                    <td colSpan={6} className="dm-empty">No passengers match “{q}”.</td>
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
                <img
                  src="/scanner.jpg" // replace with your scanner image path
                  alt="Scanner device"
                  style={{ width: "180px", height: "180px", borderRadius: "50%" }}
                />
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
