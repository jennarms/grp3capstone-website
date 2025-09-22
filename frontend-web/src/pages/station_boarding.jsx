import { useEffect, useMemo, useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_boarding.css";

/* All stations for the dropdowns */
const STATIONS = [
  "Pinagbuhatan",
  "San Joaquin",
  "Maybunga",
  "Kalawaan",
  "Guadalupe",
  "Valenzuela",
  "Hulo",
  "Lambingan",
  "Santa Ana",
  "PUP",
  "Lawton",
  "Quinta",
  "Escolta",
];

export function Boarding() {
  const [tableQuery, setTableQuery] = useState("");

  // ===== Modals / prompts =====
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [showAcceptPrompt, setShowAcceptPrompt] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [bookingToAccept, setBookingToAccept] = useState(null);

  const [showScan, setShowScan] = useState(false);
  const [scanState, setScanState] = useState(null); // "scanning" | "success" | null
  const [scanResult, setScanResult] = useState(null);

  const [showManualForm, setShowManualForm] = useState(false);

  // Success after adding manual booking
  const [showManualSuccess, setShowManualSuccess] = useState(false);
  const [addedManual, setAddedManual] = useState(null); // { userID, qrCodeID, origin, destination }

  // ----- Route / schedule data -----
  const routeTime = "8:40 AM";
  const stops = [
    { name: "Quinta", time: "8:22 AM", status: "Departed" },
    { name: "PUP", time: "8:40 AM", status: "Arrived" },
    { name: "Sta - Ana", time: "8:55 AM", status: "Approaching" },
    { name: "Lambingan", time: "9:00 AM", status: "Approaching" },
  ];

  const currentStop = useMemo(() => {
    const match = stops.find((s) => s.time === routeTime);
    return match ? match.name : "PUP";
  }, [stops, routeTime]);

  // ----- Passenger list -----
  const [passengerList, setPassengerList] = useState([
    {
      bookingID: "BID009212", userID: "UID002489", qrCodeID: "TC00203",
      origin: "Escolta", destination: "Guadalupe",
      departureDate: "2025/06/12", departureTime: "8:00 am",
      paymentStatus: "P", paidAmount: 45.0, paidAt: "8:00 am",
      bookingStatus: "OB", bookingSource: "MA"
    },
    {
      bookingID: "BID009432", userID: "UID762571", qrCodeID: "TC00204",
      origin: "Quinta", destination: "Lambingan",
      departureDate: "2025/06/12", departureTime: "8:22 am",
      paymentStatus: "P", paidAmount: 30.0, paidAt: "8:00 am",
      bookingStatus: "OB", bookingSource: "MA"
    },
    {
      bookingID: "BID021353", userID: "UID638193", qrCodeID: "TC00445",
      origin: "Escolta", destination: "Valenzuela",
      departureDate: "2025/06/12", departureTime: "8:40 am",
      paymentStatus: "P", paidAmount: 40.0, paidAt: "8:10 am",
      bookingStatus: "CO", bookingSource: "CB"
    },
    {
      bookingID: "BID032212", userID: "UID078263", qrCodeID: "TC08798",
      origin: "Escolta", destination: "Guadalupe",
      departureDate: "2025/06/12", departureTime: "8:50 am",
      paymentStatus: "P", paidAmount: 45.0, paidAt: "8:10 am",
      bookingStatus: "CO", bookingSource: "MA"
    },
    {
      bookingID: "BID024712", userID: "UID012861", qrCodeID: "TC06594",
      origin: "Lambingan", destination: "Kalawaan",
      departureDate: "2025/06/12", departureTime: "—",
      paymentStatus: "PG", paidAmount: 38.0, paidAt: "8:38 am",
      bookingStatus: "PE", bookingSource: "CB"
    },
    {
      bookingID: "BID009123", userID: "UID097260", qrCodeID: "TC09836",
      origin: "Sta. Ana", destination: "Guadalupe",
      departureDate: "2025/06/12", departureTime: "—",
      paymentStatus: "PG", paidAmount: 20.0, paidAt: "8:40 am",
      bookingStatus: "PE", bookingSource: "GM"
    },
    {
      bookingID: "BID012563", userID: "UID897217", qrCodeID: "TC04764",
      origin: "Lawton", destination: "Hulo",
      departureDate: "2025/06/12", departureTime: "—",
      paymentStatus: "F", paidAmount: 0.0, paidAt: "8:42 am",
      bookingStatus: "CA", bookingSource: "MA"
    },
    {
      bookingID: "BID322112", userID: "UID212414", qrCodeID: "TC09894",
      origin: "Escolta", destination: "Quinta",
      departureDate: "2025/06/12", departureTime: "—",
      paymentStatus: "P", paidAmount: 30.0, paidAt: "8:00 am",
      bookingStatus: "DI", bookingSource: "MB"
    },
  ]);

  // ===== Manual booking form state + validation =====
  const emptyManual = {
    bookingID: "", userID: "", qrCodeID: "",
    origin: "", destination: "",
    departureDate: "", departureTime: "",
    paymentStatus: "", paidAmount: "", paidAt: "",
    bookingStatus: "", bookingSource: ""
  };
  const [manualData, setManualData] = useState(emptyManual);
  const [manualErrors, setManualErrors] = useState({});

  const validateManual = (d) => {
    const errs = {};
    const req = (k, label) => { if (!String(d[k] ?? "").trim()) errs[k] = label + " is required"; };

    req("bookingID", "Booking ID");
    req("userID", "User ID");
    req("qrCodeID", "QR Code ID");
    req("origin", "Origin");
    req("destination", "Destination");
    req("departureDate", "Departure date");
    req("departureTime", "Departure time");
    req("paymentStatus", "Payment status");
    req("paidAmount", "Payment amount");
    req("paidAt", "Paid at");
    req("bookingStatus", "Booking status");
    req("bookingSource", "Booking source");

    // Unique IDs
    if (d.bookingID && passengerList.some((p) => p.bookingID === d.bookingID)) {
      errs.bookingID = "Booking ID already exists";
    }
    if (d.qrCodeID && passengerList.some((p) => p.qrCodeID === d.qrCodeID)) {
      errs.qrCodeID = "QR Code ID already exists";
    }

    // Logical checks
    if (d.origin && d.destination && d.origin === d.destination) {
      errs.destination = "Destination must be different from origin";
    }

    // Formats (accept YYYY-MM-DD or YYYY/MM/DD)
    const dateRe = /^\d{4}[/-]\d{2}[/-]\d{2}$/;
    const timeRe = /^(1[0-2]|0?[1-9]):[0-5][0-9]\s?(am|pm)$/i;
    if (d.departureDate && !dateRe.test(d.departureDate)) errs.departureDate = "Use YYYY-MM-DD";
    if (d.departureTime && !timeRe.test(d.departureTime)) errs.departureTime = "Use h:mm am/pm";

    const okPay = ["P", "PG", "F"];
    if (d.paymentStatus && okPay.indexOf(d.paymentStatus) === -1) {
      errs.paymentStatus = "Use P, PG, or F";
    }

    const okStatus = ["OB", "CO", "PE", "CA", "DI"];
    if (d.bookingStatus && okStatus.indexOf(d.bookingStatus) === -1) {
      errs.bookingStatus = "Use OB, CO, PE, CA, DI";
    }

    const okSource = ["MA", "MB", "CB", "GM"];
    if (d.bookingSource && okSource.indexOf(d.bookingSource) === -1) {
      errs.bookingSource = "Use MA, MB, CB, GM";
    }

    const amt = Number(d.paidAmount);
    if (String(d.paidAmount).trim() === "" || isNaN(amt) || amt < 0) {
      errs.paidAmount = "Enter a non-negative number";
    }

    return errs;
  };

  const isManualValid = useMemo(() => {
    return Object.keys(validateManual(manualData)).length === 0;
  }, [manualData, passengerList]);

  const onManualNext = () => {
    const errs = validateManual(manualData);
    setManualErrors(errs);
    if (Object.keys(errs).length === 0) {
      const newRow = {
        ...manualData,
        paidAmount: Number(manualData.paidAmount),
        // Normalize to slashes for table consistency
        departureDate: (manualData.departureDate || "").replace(/-/g, "/"),
      };
      setPassengerList((prev) => [...prev, newRow]);

      setAddedManual({
        userID: newRow.userID,
        qrCodeID: newRow.qrCodeID,
        origin: newRow.origin,
        destination: newRow.destination,
      });
      setShowManualSuccess(true);

      setShowManualForm(false);
      setManualData(emptyManual);
      setManualErrors({});
    }
  };

  // Filter by table search
  const finalFiltered = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    if (!q) return passengerList;
    return passengerList.filter((p) =>
      Object.values(p).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [tableQuery, passengerList]);

  // ---- Actions for PE rows ----
  const handleAccept = (bookingID) => {
    setPassengerList((prev) =>
      prev.map((p) =>
        p.bookingID === bookingID ? { ...p, bookingStatus: "OB" } : p
      )
    );
  };
  const handleCancel = (bookingID) => {
    setPassengerList((prev) =>
      prev.map((p) =>
        p.bookingID === bookingID ? { ...p, bookingStatus: "CA" } : p
      )
    );
  };

  // status → class for coloring
  const bookingStatusClass = (s) => {
    switch (s) {
      case "OB": return "status-badge status-ob";
      case "CO": return "status-badge status-co";
      case "PE": return "status-badge status-pe";
      case "CA": return "status-badge status-ca";
      case "DI": return "status-badge status-di";
      default: return "status-badge";
    }
  };

  // ESC closes any open modal
  useEffect(() => {
    const active =
      showManualSuccess || showCancelPrompt || showAcceptPrompt || showManualForm || showScan;
    if (!active) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowManualSuccess(false);
        setShowCancelPrompt(false);
        setShowAcceptPrompt(false);
        setShowManualForm(false);
        setShowScan(false);
        setBookingToCancel(null);
        setBookingToAccept(null);
        setScanState(null);
        setScanResult(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showManualSuccess, showCancelPrompt, showAcceptPrompt, showManualForm, showScan]);

  // Simulated scanning
  useEffect(() => {
    if (showScan && scanState === "scanning") {
      const t = setTimeout(() => {
        const pending = passengerList.find((p) => p.bookingStatus === "PE") || passengerList[0];
        setScanResult({
          name: "Elijah Trinidad",
          code: (pending && pending.qrCodeID) || "—",
          from: (pending && pending.origin) || "—",
          to: (pending && pending.destination) || "—",
        });
        setScanState("success");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [showScan, scanState, passengerList]);

  return (
    <div className="boarding-landing-container">
      <StationNavbar />

      <div className="main-content">
        {/* Header with schedule box */}
        <header className="main-header">
          <div className="boarding-header-info">
            <h1>Boarding Management</h1>

            {/* ROUTE CARD */}
            <div className="route-card">
              <div className="route-card__top">
                <div className="route-card__path">PUP → Kalawaan</div>
                <div className="route-card__time">{routeTime}</div>
                <div className="route-card__booked">
                  Booked: <strong>4/30</strong>
                </div>
              </div>

              <div className="stops-list">
                {stops.map((s) => {
                  const isCurrent = s.name === currentStop;
                  return (
                    <div className={"stop-row" + (isCurrent ? " is-current" : "")} key={s.name}>
                      <span className="stop-pin-slot" aria-hidden="true">
                        {isCurrent ? (
                          <span className="pin" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                            </svg>
                          </span>
                        ) : null}
                      </span>
                      <span className="stop-name">{s.name}</span>
                      <span className="stop-time">{s.time}</span>
                      <span className="status">{s.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* END ROUTE CARD */}
          </div>

          <LogoutButton />
        </header>

        {/* Buttons */}
        <section className="actions-bar">
          <button
            className="scan-btn"
            onClick={() => {
              setShowScan(true);
              setScanState("scanning");
              setScanResult(null);
            }}
          >
            <span className="btn-icon">💻</span>
            Scan
          </button>

          <button
            className="manual-booking-btn"
            onClick={() => setShowManualForm(true)}
          >
            <span className="btn-icon">📝</span>
            Manual Booking
          </button>
        </section>

        {/* Passenger header (title + search) */}
        <section className="passenger-head-section">
          <div className="table-header">
            <h3>Passenger List</h3>
            <div className="table-search" role="search">
              <svg
                className="table-search-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <line x1="16.65" y1="16.65" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                className="table-search-input"
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                placeholder="Search passenger"
                aria-label="Search passenger"
              />
            </div>
          </div>
        </section>

        {/* Passenger Table */}
        <section className="boarding-table-section">
          <div className="table-wrapper">
            <table className="passenger-list-table">
              <thead>
                <tr>
                  <th>Booking_ID</th>
                  <th>User ID</th>
                  <th>Qrcode_ID</th>
                  <th>origin</th>
                  <th>destination</th>
                  <th>departure_date</th>
                  <th>departure_time</th>
                  <th>payment_status</th>
                  <th>paid_amount</th>
                  <th>paid_at</th>
                  <th>booking_status</th>
                  <th>booking_source</th>
                  <th>action</th>
                </tr>
              </thead>
              <tbody>
                {finalFiltered.map((p) => (
                  <tr key={p.bookingID}>
                    <td>{p.bookingID}</td>
                    <td>{p.userID}</td>
                    <td>{p.qrCodeID}</td>
                    <td>{p.origin}</td>
                    <td>{p.destination}</td>
                    <td>{p.departureDate}</td>
                    <td>{p.departureTime}</td>
                    <td>{p.paymentStatus}</td>
                    <td>{p.paidAmount.toFixed(2)}</td>
                    <td>{p.paidAt}</td>
                    <td>
                      <span className={bookingStatusClass(p.bookingStatus)}>
                        {p.bookingStatus}
                      </span>
                    </td>
                    <td>{p.bookingSource}</td>
                    <td>
                      {p.bookingStatus === "PE" ? (
                        <div className="action-cell">
                          <button
                            className="chip-btn chip-accept"
                            onClick={() => {
                              setBookingToAccept(p.bookingID);
                              setShowAcceptPrompt(true);
                            }}
                            aria-label={"Accept booking " + p.bookingID}
                          >
                            Accept
                          </button>
                          <button
                            className="chip-btn chip-cancel"
                            onClick={() => {
                              setBookingToCancel(p.bookingID);
                              setShowCancelPrompt(true);
                            }}
                            aria-label={"Cancel booking " + p.bookingID}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 8 - finalFiltered.length) }).map((_, i) => (
                  <tr key={"empty-" + i}>
                    <td colSpan={13}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ========= Accept Passenger Prompt ========= */}
        {showAcceptPrompt && (
          <div
            className="boarding-modal-backdrop"
            onClick={() => {
              setShowAcceptPrompt(false);
              setBookingToAccept(null);
            }}
            aria-hidden="true"
          >
            <div
              className="boarding-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="acceptPromptTitle"
              aria-describedby="acceptPromptDesc"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="boarding-modal-title-row">
                <span className="boarding-modal-qmark">?</span>
                <h4 id="acceptPromptTitle">Accept Passenger</h4>
              </div>
              <p id="acceptPromptDesc" className="boarding-modal-sub">
                Mark this pending booking as On Board (OB)?
              </p>
              <div className="boarding-modal-actions">
                <button
                  className="boarding-modal-btn boarding-modal-cancel"
                  onClick={() => {
                    setShowAcceptPrompt(false);
                    setBookingToAccept(null);
                  }}
                >
                  Back
                </button>
                <button
                  className="boarding-modal-btn boarding-modal-yes"
                  onClick={() => {
                    if (bookingToAccept) handleAccept(bookingToAccept);
                    setShowAcceptPrompt(false);
                    setBookingToAccept(null);
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========= Cancel Passenger Prompt ========= */}
        {showCancelPrompt && (
          <div
            className="boarding-modal-backdrop"
            onClick={() => {
              setShowCancelPrompt(false);
              setBookingToCancel(null);
            }}
            aria-hidden="true"
          >
            <div
              className="boarding-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancelPromptTitle"
              aria-describedby="cancelPromptDesc"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="boarding-modal-title-row">
                <span className="boarding-modal-qmark">?</span>
                <h4 id="cancelPromptTitle">Cancel Passenger Manually</h4>
              </div>
              <p id="cancelPromptDesc" className="boarding-modal-sub">
                Are you sure you want to cancel this passenger on board?
              </p>
              <div className="boarding-modal-actions">
                <button
                  className="boarding-modal-btn boarding-modal-cancel"
                  onClick={() => {
                    setShowCancelPrompt(false);
                    setBookingToCancel(null);
                  }}
                >
                  Back
                </button>
                <button
                  className="boarding-modal-btn boarding-modal-yes-danger"
                  onClick={() => {
                    if (bookingToCancel) handleCancel(bookingToCancel);
                    setShowCancelPrompt(false);
                    setBookingToCancel(null);
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========= Manual Booking Form ========= */}
        {showManualForm && (
          <div
            className="boarding-modal-backdrop"
            onClick={() => setShowManualForm(false)}
            aria-hidden="true"
          >
            <div
              className="boarding-manual-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="manualFormTitle"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="manualFormTitle" className="boarding-manual-title">Manual Booking</h3>

              <div className="boarding-manual-section">
                <h4 className="boarding-manual-subtitle">Register</h4>
                <p className="boarding-manual-desc">
                  Please present passenger’s ID for manual confirmation.
                </p>

                <div className="boarding-manual-grid">
                  {/* Booking ID */}
                  <div>
                    <input
                      className={"boarding-manual-input " + (manualErrors.bookingID ? "boarding-field-error" : "")}
                      placeholder="Booking ID"
                      value={manualData.bookingID}
                      onChange={(e) => setManualData((v) => ({ ...v, bookingID: e.target.value }))}
                    />
                    {manualErrors.bookingID && <div className="boarding-error-text">{manualErrors.bookingID}</div>}
                  </div>

                  {/* User ID */}
                  <div>
                    <input
                      className={"boarding-manual-input " + (manualErrors.userID ? "boarding-field-error" : "")}
                      placeholder="User ID"
                      value={manualData.userID}
                      onChange={(e) => setManualData((v) => ({ ...v, userID: e.target.value }))}
                    />
                    {manualErrors.userID && <div className="boarding-error-text">{manualErrors.userID}</div>}
                  </div>

                  {/* QR Code ID */}
                  <div>
                    <input
                      className={"boarding-manual-input " + (manualErrors.qrCodeID ? "boarding-field-error" : "")}
                      placeholder="Qr Code ID"
                      value={manualData.qrCodeID}
                      onChange={(e) => setManualData((v) => ({ ...v, qrCodeID: e.target.value }))}
                    />
                    {manualErrors.qrCodeID && <div className="boarding-error-text">{manualErrors.qrCodeID}</div>}
                  </div>

                  {/* Origin (dropdown) */}
                  <div className="boarding-manual-span2">
                    <select
                      className={"boarding-manual-input boarding-manual-select " + (manualErrors.origin ? "boarding-field-error" : "")}
                      value={manualData.origin}
                      onChange={(e) => {
                        const origin = e.target.value;
                        setManualData((v) => ({
                          ...v,
                          origin,
                          destination: v.destination === origin ? "" : v.destination
                        }));
                      }}
                    >
                      <option value="" disabled>Select Origin</option>
                      {STATIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {manualErrors.origin && <div className="boarding-error-text">{manualErrors.origin}</div>}
                  </div>

                  {/* Destination (dropdown, excludes selected origin) */}
                  <div>
                    <select
                      className={"boarding-manual-input boarding-manual-select " + (manualErrors.destination ? "boarding-field-error" : "")}
                      value={manualData.destination}
                      onChange={(e) => setManualData((v) => ({ ...v, destination: e.target.value }))}
                    >
                      <option value="" disabled>Select Destination</option>
                      {STATIONS.filter((s) => s !== manualData.origin).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {manualErrors.destination && <div className="boarding-error-text">{manualErrors.destination}</div>}
                  </div>

                  {/* Departure Date (native calendar) */}
                  <div className="boarding-manual-span2">
                    <input
                      type="date"
                      className={"boarding-manual-input boarding-manual-date " + (manualErrors.departureDate ? "boarding-field-error" : "")}
                      value={manualData.departureDate}  /* expects YYYY-MM-DD from browser */
                      onChange={(e) => setManualData((v) => ({ ...v, departureDate: e.target.value }))}
                    />
                    {manualErrors.departureDate && <div className="boarding-error-text">{manualErrors.departureDate}</div>}
                  </div>

                  {/* Departure Time */}
                  <div>
                    <input
                      className={"boarding-manual-input " + (manualErrors.departureTime ? "boarding-field-error" : "")}
                      placeholder="Departure Time (h:mm am/pm)"
                      value={manualData.departureTime}
                      onChange={(e) => setManualData((v) => ({ ...v, departureTime: e.target.value }))}
                    />
                    {manualErrors.departureTime && <div className="boarding-error-text">{manualErrors.departureTime}</div>}
                  </div>

                  {/* Payment Status */}
                  <div>
                    <input
                      className={"boarding-manual-input " + (manualErrors.paymentStatus ? "boarding-field-error" : "")}
                      placeholder="Payment Status (P/PG/F)"
                      value={manualData.paymentStatus}
                      onChange={(e) => setManualData((v) => ({ ...v, paymentStatus: e.target.value }))}
                    />
                    {manualErrors.paymentStatus && <div className="boarding-error-text">{manualErrors.paymentStatus}</div>}
                  </div>

                  {/* Payment Amount */}
                  <div>
                    <input
                      className={"boarding-manual-input " + (manualErrors.paidAmount ? "boarding-field-error" : "")}
                      placeholder="Payment Amount"
                      value={manualData.paidAmount}
                      onChange={(e) => setManualData((v) => ({ ...v, paidAmount: e.target.value }))}
                    />
                    {manualErrors.paidAmount && <div className="boarding-error-text">{manualErrors.paidAmount}</div>}
                  </div>

                  {/* Paid At */}
                  <div>
                    <input
                      className={"boarding-manual-input " + (manualErrors.paidAt ? "boarding-field-error" : "")}
                      placeholder="Paid At (e.g., 8:10 am)"
                      value={manualData.paidAt}
                      onChange={(e) => setManualData((v) => ({ ...v, paidAt: e.target.value }))}
                    />
                    {manualErrors.paidAt && <div className="boarding-error-text">{manualErrors.paidAt}</div>}
                  </div>

                  {/* Booking Status */}
                  <div className="boarding-manual-span2">
                    <input
                      className={"boarding-manual-input " + (manualErrors.bookingStatus ? "boarding-field-error" : "")}
                      placeholder="Booking Status (OB/CO/PE/CA/DI)"
                      value={manualData.bookingStatus}
                      onChange={(e) => setManualData((v) => ({ ...v, bookingStatus: e.target.value }))}
                    />
                    {manualErrors.bookingStatus && <div className="boarding-error-text">{manualErrors.bookingStatus}</div>}
                  </div>

                  {/* Booking Source */}
                  <div>
                    <input
                      className={"boarding-manual-input " + (manualErrors.bookingSource ? "boarding-field-error" : "")}
                      placeholder="Booking Source (MA/MB/CB/GM)"
                      value={manualData.bookingSource}
                      onChange={(e) => setManualData((v) => ({ ...v, bookingSource: e.target.value }))}
                    />
                    {manualErrors.bookingSource && <div className="boarding-error-text">{manualErrors.bookingSource}</div>}
                  </div>
                </div>

                <div className="boarding-manual-actions">
                  <button
                    className="boarding-manual-next"
                    onClick={onManualNext}
                    disabled={!isManualValid}
                    aria-disabled={!isManualValid}
                    title={!isManualValid ? "Fill all fields correctly to continue" : "Next"}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========= Success after Manual Booking ========= */}
        {showManualSuccess && (
          <div
            className="boarding-modal-backdrop"
            onClick={() => setShowManualSuccess(false)}
            aria-hidden="true"
          >
            <div
              className="boarding-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="manualSuccessTitle"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="manualSuccessTitle" className="manual-success-title">Manual Booking</h3>
              <h4 className="manual-success-sub">Passenger Added Successfully 🎉</h4>

              <div className="manual-success-lines">
                <div>User ID: <strong>{addedManual && addedManual.userID}</strong></div>
                <div>Ticket Code: <strong>{addedManual && addedManual.qrCodeID}</strong></div>
                <div>From: {addedManual && addedManual.origin}</div>
                <div>Destination: {addedManual && addedManual.destination}</div>
              </div>

              <div className="manual-success-banner">
                Please don’t forget to collect the passenger’s ticket.
              </div>

              <div className="boarding-modal-actions">
                <button
                  className="boarding-modal-btn boarding-modal-yes"
                  onClick={() => setShowManualSuccess(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========= Scan Modal ========= */}
        {showScan && (
          <div
            className="boarding-modal-backdrop"
            onClick={() => {
              setShowScan(false);
              setScanState(null);
              setScanResult(null);
            }}
            aria-hidden="true"
          >
            <div
              className={"boarding-scan-card" + (scanState === "success" ? " boarding-scan--left" : "")}
              role="dialog"
              aria-modal="true"
              aria-labelledby="scanTitle"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="scanTitle" className="boarding-scan-title">Scan Passenger QR Code</h3>

              {scanState === "scanning" && (
                <>
                  <p className="boarding-scan-sub">
                    Please place the passenger’s QR code in front of the scanner device.
                  </p>
                  <div className="boarding-scan-illustration" aria-hidden="true">📷</div>
                  <p className="boarding-scan-hint">Currently scanning…</p>
                  <p className="boarding-scan-hint">
                    If scanning doesn't work, use manual.
                  </p>
                  <div className="boarding-scan-actions">
                    <button
                      className="boarding-scan-close"
                      onClick={() => {
                        setShowScan(false);
                        setScanState(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}

              {scanState === "success" && (
                <>
                  <h4 className="boarding-scan-confirm">Passenger Confirmed 🎉</h4>
                  <div className="boarding-scan-details">
                    {scanResult && scanResult.name ? (
                      <div className="boarding-scan-line">
                        <strong>{scanResult.name}</strong>
                      </div>
                    ) : null}
                    <div className="boarding-scan-line">
                      Ticket Code: <strong>{(scanResult && scanResult.code) || "—"}</strong>
                    </div>
                    <div className="boarding-scan-line">From: {(scanResult && scanResult.from) || "—"}</div>
                    <div className="boarding-scan-line">Destination: {(scanResult && scanResult.to) || "—"}</div>
                  </div>
                  <div className="boarding-scan-actions">
                    <button
                      className="boarding-scan-close"
                      onClick={() => {
                        setShowScan(false);
                        setScanState(null);
                        setScanResult(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* ======================================= */}
      </div>
    </div>
  );
}
