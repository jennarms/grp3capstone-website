import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_boarding.css";

/* Read query params from URL (time/seat counts/station/direction/date) */
const getParams = () => {
  const sp = new URLSearchParams(window.location.search);
  return {
    time: sp.get("time") || "8:40 AM",
    total: parseInt(sp.get("total") || "30", 10),
    avail: parseInt(sp.get("avail") || "26", 10), // default so Booked 4/30 matches your UI
    booked: parseInt(sp.get("booked") || "4", 10),
    dir: (sp.get("dir") || "forward").toLowerCase(), // "forward" | "reverse"
    station: sp.get("station") || "PUP → Kalawaan",
    date: sp.get("date") || "",
  };
};

/* All stations for the dropdowns */
const STATIONS = [
  "Pinagbuhatan",
  "Kalawaan",
  "San Joaquin",
  "Maybunga",
  "Guadalupe",
  "Hulo",
  "Valenzuela",
  "Lambingan",
  "Sta. Ana",
  "PUP",
  "Quinta",
  "Lawton",
  "Escolta",
];

/* fixed departure schedules for the dropdown */
const DEPARTURE_SCHEDULES = [
  "8:22 AM",
  "9:07 AM",
  "10:07 AM",
  "11:07 AM",
  "12:07 PM",
  "1:07 PM",
  "2:07 PM",
  "3:07 PM",
  "4:07 PM",
  "5:07 PM",
  "5:37 PM",
];

/* === Fare matrix (₱) — symmetric, from your photo ===
   Index order follows STATIONS exactly.
*/
const FARE_MATRIX = (() => {
  //             PIN  KAL  SJO  MAY  GUA  HUL  VAL  LAM  STA  PUP  QUI  LAW  ESC
  const rowPIN = [  0,  18,  28,  43,  45,  50,  55,  60,  65,  95,  95,  95,  95 ];
  const rowKAL = [ 18,   0,  15,  30,  25,  30,  35,  40,  45,  75,  75,  75,  75 ];
  const rowSJO = [ 28,  15,   0,  15,  18,  23,  28,  35,  38,  68,  68,  68,  68 ];
  const rowMAY = [ 43,  30,  15,   0,  30,  45,  50,  50,  50,  80,  80,  80,  80 ];
  const rowGUA = [ 45,  25,  18,  30,   0,  15,  20,  20,  20,  50,  50,  50,  50 ];
  const rowHUL = [ 50,  30,  23,  45,  15,   0,  15,  20,  20,  45,  45,  45,  45 ];
  const rowVAL = [ 55,  35,  28,  50,  20,  15,   0,  20,  20,  40,  40,  40,  40 ];
  const rowLAM = [ 60,  40,  35,  50,  20,  20,  20,   0,  15,  35,  35,  35,  35 ];
  const rowSTA = [ 65,  45,  38,  50,  20,  20,  20,  15,   0,  30,  30,  30,  30 ];
  const rowPUP = [ 95,  75,  68,  80,  45,  45,  40,  35,  30,   0,  20,  30,  30 ];
  const rowQUI = [ 95,  75,  68,  80,  45,  45,  40,  35,  30,  20,   0,  30,  30 ];
  const rowLAW = [ 95,  75,  68,  80,  45,  45,  40,  35,  30,  30,  30,   0,  30 ];
  const rowESC = [ 95,  75,  68,  80,  45,  45,  40,  35,  30,  30,  30,  30,   0 ];
  return [
    rowPIN,rowKAL,rowSJO,rowMAY,rowGUA,rowHUL,rowVAL,rowLAM,rowSTA,rowPUP,rowQUI,rowLAW,rowESC
  ];
})();

const getFare = (origin, destination) => {
  if (!origin || !destination) return "";
  if (origin === destination) return 0;
  const i = STATIONS.indexOf(origin);
  const j = STATIONS.indexOf(destination);
  if (i === -1 || j === -1) return "";
  return FARE_MATRIX[i][j] ?? "";
};

/* helpers to prefill dates/times on open */
const toYYYYMMDD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const toHmma = (d = new Date()) => {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

/* nearest upcoming schedule helper */
const parseTimeToMinutes = (s) => {
  const [time, mer] = s.split(" ");
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const merUp = (mer || "").toUpperCase();
  h = h % 12 + (merUp === "PM" ? 12 : 0);
  return h * 60 + m;
};
const getNearestSchedule = (now = new Date()) => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const list = DEPARTURE_SCHEDULES.map((t) => ({ t, mins: parseTimeToMinutes(t) }));
  const upcoming = list.find((x) => x.mins >= nowMinutes);
  return (upcoming ? upcoming.t : list[0].t);
};

export function Boarding() {
  const qp = getParams();

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

  // multi-step manual booking: 1 Passenger, 2 Booking, 3 Payment, 4 QR
  const [manualStep, setManualStep] = useState(1);

  // Success after adding manual booking
  const [showManualSuccess, setShowManualSuccess] = useState(false);
  const [addedManual, setAddedManual] = useState(null); // { userID, qrCodeID, origin, destination }

  // ----- Route / schedule data (now driven by URL params) -----
  const routeTime = qp.time;
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

  // ----- Passenger list (demo data preserved) -----
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
    paymentStatus: "PG",
    paidAmount: "", paidAt: "",
    bookingStatus: "PE",
    bookingSource: "MB"
  };
  const [manualData, setManualData] = useState(emptyManual);

  // Passenger info (Step 1)
  const emptyPassenger = {
    firstName: "", lastName: "", address: "",
    profession: "", contactNumber: "",
    age: "", gender: "", platformSource: "MB"
  };
  const [passengerInfo, setPassengerInfo] = useState(emptyPassenger);

  const [manualErrors, setManualErrors] = useState({});

  const validatePassenger = (d) => {
    const errs = {};
    const req = (k, label) => { if (!String(d[k] ?? "").trim()) errs[k] = label + " is required"; };

    req("firstName", "First name");
    req("lastName", "Last name");
    req("address", "Address");
    req("profession", "Profession");
    req("contactNumber", "Contact number");
    req("age", "Age");
    req("gender", "Gender");
    req("platformSource", "Platform source");

    const digits = (d.contactNumber || "").replace(/\D/g, "");
    if (digits.length < 7) errs.contactNumber = "Enter a valid contact number";

    const ageNum = Number(d.age);
    if (isNaN(ageNum) || ageNum <= 0 || !Number.isInteger(ageNum) || ageNum > 120) {
      errs.age = "Enter a valid age (1–120)";
    }

    const okGenders = ["Male", "Female", "Other"];
    if (d.gender && okGenders.indexOf(d.gender) === -1) {
      errs.gender = "Select Male, Female, or Other";
    }

    if (d.platformSource !== "MB") {
      errs.platformSource = "Platform Source must be MB";
    }

    return errs;
  };

  // Booking validation (Step 2)
  const validateManual = (d) => {
    const errs = {};
    const req = (k, label) => { if (!String(d[k] ?? "").trim()) errs[k] = label + " is required"; };

    req("bookingID", "Booking ID");
    req("userID", "User ID");
    req("origin", "Origin");
    req("destination", "Destination");
    req("departureDate", "Departure date");
    req("departureTime", "Departure time");
    req("paidAt", "Paid at");
    req("bookingStatus", "Booking status");
    req("bookingSource", "Booking source");

    if (d.bookingID && passengerList.some((p) => p.bookingID === d.bookingID)) {
      errs.bookingID = "Booking ID already exists";
    }
    if (d.qrCodeID && passengerList.some((p) => p.qrCodeID === d.qrCodeID)) {
      errs.qrCodeID = "QR Code ID already exists";
    }

    if (d.origin && d.destination && d.origin === d.destination) {
      errs.destination = "Destination must be different from origin";
    }

    const dateRe = /^\d{4}[/-]\d{2}[/-]\d{2}$/;
    const timeRe = /^(1[0-2]|0?[1-9]):[0-5][0-9]\s?(am|pm)$/i;
    if (d.departureDate && !dateRe.test(d.departureDate)) errs.departureDate = "Use YYYY-MM-DD";
    if (d.departureTime && !timeRe.test(d.departureTime)) errs.departureTime = "Use h:mm am/pm";

    const okStatus = ["OB", "CO", "PE", "CA", "DI"];
    if (d.bookingStatus && okStatus.indexOf(d.bookingStatus) === -1) {
      errs.bookingStatus = "Use OB, CO, PE, CA, or DI";
    }

    const okSource = ["MA", "MB", "CB", "GM"];
    if (d.bookingSource && okSource.indexOf(d.bookingSource) === -1) {
      errs.bookingSource = "Use MA, MB, CB, GM";
    }

    return errs;
  };

  // Payment validation (Step 3)
  const validatePayment = (d) => {
    const errs = {};
    const amt = Number(d.paidAmount);
    if (String(d.paidAmount).trim() === "" || isNaN(amt) || amt < 0) {
      errs.paidAmount = "Enter a non-negative number";
    }
    return errs;
  };

  const isManualValid = useMemo(() => {
    return Object.keys(validateManual(manualData)).length === 0;
  }, [manualData, passengerList]);

  // helper to generate unique QR if empty
  const generateUniqueQR = () => {
    const exists = (code) => passengerList.some((p) => p.qrCodeID === code);
    let code = "";
    do {
      code = "TC" + Math.floor(10000 + Math.random() * 89999);
    } while (exists(code));
    return code;
  };

  // Auto-calc fare whenever origin/destination change (Step 2)
  useEffect(() => {
    if (!manualData.origin || !manualData.destination) return;
    const fare = getFare(manualData.origin, manualData.destination);
    setManualData((v) => ({ ...v, paidAmount: fare === "" ? "" : Number(fare).toFixed(2) }));
  }, [manualData.origin, manualData.destination]);

  // Print: only QR ticket area
  const qrPrintRef = useRef(null);
  const printQR = () => {
    window.print();
  };

  // Step flow
  const onManualNext = () => {
    if (manualStep === 1) {
      const errs = validatePassenger(passengerInfo);
      setManualErrors(errs);
      if (Object.keys(errs).length === 0) {
        setManualErrors({});
        setManualStep(2);
      }
      return;
    }

    if (manualStep === 2) {
      const errs = validateManual(manualData);
      setManualErrors(errs);
      if (Object.keys(errs).length === 0) {
        setManualErrors({});
        setManualStep(3);
      }
      return;
    }

    if (manualStep === 4) {
      // Finalize & add row
      const newRow = {
        ...manualData,
        paidAmount: Number(manualData.paidAmount || 0),
        departureDate: (manualData.departureDate || "").replace(/-/g, "/"),
        bookingSource: "MB",
        bookingStatus: "PE",
        paymentStatus: manualData.paymentStatus || "PG",
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
      setManualStep(1);
      setPassengerInfo(emptyPassenger);
      setManualData(emptyManual);
      setManualErrors({});
      return;
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
      prev.map((p) => (p.bookingID === bookingID ? { ...p, bookingStatus: "OB" } : p))
    );
  };
  const handleCancel = (bookingID) => {
    setPassengerList((prev) =>
      prev.map((p) => (p.bookingID === bookingID ? { ...p, bookingStatus: "CA" } : p))
    );
  };

  // status → class for coloring
  const bookingStatusClass = (s) => {
    switch (s) {
      case "OB":
        return "status-badge status-ob";
      case "CO":
        return "status-badge status-co";
      case "PE":
        return "status-badge status-pe";
      case "CA":
        return "status-badge status-ca";
      case "DI":
        return "status-badge status-di";
      default:
        return "status-badge";
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

        setManualStep(1);
        setPassengerInfo(emptyPassenger);
        setManualData(emptyManual);
        setManualErrors({});
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

  // Header values from query params
  const bookedCount = Number.isFinite(qp.booked) ? qp.booked : Math.max(0, qp.total - qp.avail);
  const routePath = `${qp.station} — ${qp.dir.toUpperCase()} DIRECTION`;

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
                <div className="route-card__path">{routePath}</div>
                <div className="route-card__time">{routeTime}</div>
                <div className="route-card__booked">
                  Booked: <strong>{bookedCount}/{qp.total}</strong>
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
                            <svg
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              width="18"
                              height="18"
                              aria-hidden="true"
                            >
                              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
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
            onClick={() => {
              setManualStep(1);
              setPassengerInfo((v) => ({
                ...v,
                firstName: "",
                lastName: "",
                address: "",
                profession: "",
                contactNumber: "",
                age: "",
                gender: "",
                platformSource: "MB",
              }));
              const now = new Date();
              const nearest = getNearestSchedule(now);
              setManualData({
                bookingID: "",
                userID: "",
                qrCodeID: "",
                origin: "",
                destination: "",
                departureDate: toYYYYMMDD(now),
                departureTime: nearest,
                paymentStatus: "PG",
                paidAmount: "",
                paidAt: toHmma(now),
                bookingStatus: "PE",
                bookingSource: "MB",
              });
              setManualErrors({});
              setShowManualForm(true);
            }}
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
                <line
                  x1="16.65"
                  y1="16.65"
                  x2="20"
                  y2="20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
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
                    <td>
                      {p.paidAmount.toFixed
                        ? p.paidAmount.toFixed(2)
                        : Number(p.paidAmount || 0).toFixed(2)}
                    </td>
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

        {/* ========= Manual Booking Form (4-step) ========= */}
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

              {/* Stepper Header */}
              <div className="wizard-steps wizard-steps--four">
                <div className={"wizard-step " + (manualStep >= 1 ? "is-active" : "")}>
                  <span className="wizard-dot" /> Passenger Information
                </div>
                <div className={"wizard-step " + (manualStep >= 2 ? "is-active" : "")}>
                  <span className="wizard-dot" /> Booking Information
                </div>
                <div className={"wizard-step " + (manualStep >= 3 ? "is-active" : "")}>
                  <span className="wizard-dot" /> Payment
                </div>
                <div className={"wizard-step " + (manualStep >= 4 ? "is-active" : "")}>
                  <span className="wizard-dot" /> QR Code
                </div>
              </div>

              {/* STEP 1: Passenger Information */}
              {manualStep === 1 && (
                <div className="boarding-manual-section">
                  <h4 className="boarding-manual-subtitle">Passenger Information</h4>
                  <p className="boarding-manual-desc">
                    Please enter the passenger’s details. All fields are required.
                  </p>

                  <div className="boarding-manual-grid">
                    {/* fields unchanged from your version */}
                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">First Name</label>
                        <input
                          className={"boarding-manual-input " + (manualErrors.firstName ? "boarding-field-error" : "")}
                          placeholder="First Name"
                          value={passengerInfo.firstName}
                          onChange={(e) =>
                            setPassengerInfo((v) => ({ ...v, firstName: e.target.value }))
                          }
                        />
                      </div>
                      {manualErrors.firstName && (
                        <div className="boarding-error-text">{manualErrors.firstName}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Last Name</label>
                        <input
                          className={"boarding-manual-input " + (manualErrors.lastName ? "boarding-field-error" : "")}
                          placeholder="Last Name"
                          value={passengerInfo.lastName}
                          onChange={(e) =>
                            setPassengerInfo((v) => ({ ...v, lastName: e.target.value }))
                          }
                        />
                      </div>
                      {manualErrors.lastName && (
                        <div className="boarding-error-text">{manualErrors.lastName}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Profession</label>
                        <input
                          className={"boarding-manual-input " + (manualErrors.profession ? "boarding-field-error" : "")}
                          placeholder="Profession"
                          value={passengerInfo.profession}
                          onChange={(e) =>
                            setPassengerInfo((v) => ({ ...v, profession: e.target.value }))
                          }
                        />
                      </div>
                      {manualErrors.profession && (
                        <div className="boarding-error-text">{manualErrors.profession}</div>
                      )}
                    </div>

                    <div className="boarding-manual-span2">
                      <div className="boarding-field">
                        <label className="boarding-field-label">Address</label>
                        <input
                          className={"boarding-manual-input " + (manualErrors.address ? "boarding-field-error" : "")}
                          placeholder="Address"
                          value={passengerInfo.address}
                          onChange={(e) =>
                            setPassengerInfo((v) => ({ ...v, address: e.target.value }))
                          }
                        />
                      </div>
                      {manualErrors.address && (
                        <div className="boarding-error-text">{manualErrors.address}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Contact Number</label>
                        <input
                          className={"boarding-manual-input " + (manualErrors.contactNumber ? "boarding-field-error" : "")}
                          placeholder="Contact Number"
                          value={passengerInfo.contactNumber}
                          onChange={(e) =>
                            setPassengerInfo((v) => ({ ...v, contactNumber: e.target.value }))
                          }
                        />
                      </div>
                      {manualErrors.contactNumber && (
                        <div className="boarding-error-text">{manualErrors.contactNumber}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Age</label>
                        <input
                          className={"boarding-manual-input " + (manualErrors.age ? "boarding-field-error" : "")}
                          placeholder="Age"
                          value={passengerInfo.age}
                          onChange={(e) => setPassengerInfo((v) => ({ ...v, age: e.target.value }))}
                        />
                      </div>
                      {manualErrors.age && (
                        <div className="boarding-error-text">{manualErrors.age}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Gender</label>
                        <select
                          className={
                            "boarding-manual-input boarding-manual-select " +
                            (manualErrors.gender ? "boarding-field-error" : "")
                          }
                          value={passengerInfo.gender}
                          onChange={(e) =>
                            setPassengerInfo((v) => ({ ...v, gender: e.target.value }))
                          }
                        >
                          <option value="" disabled>
                            Select Gender
                          </option>
                          <option>Male</option>
                          <option>Female</option>
                          <option>Other</option>
                        </select>
                      </div>
                      {manualErrors.gender && (
                        <div className="boarding-error-text">{manualErrors.gender}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Platform Source</label>
                        <input
                          className={
                            "boarding-manual-input " +
                            (manualErrors.platformSource ? "boarding-field-error" : "")
                          }
                          placeholder="Platform Source"
                          value={passengerInfo.platformSource}
                          readOnly
                        />
                      </div>
                      {manualErrors.platformSource && (
                        <div className="boarding-error-text">{manualErrors.platformSource}</div>
                      )}
                    </div>
                  </div>

                  <div className="boarding-manual-actions">
                    <button className="boarding-manual-next" onClick={onManualNext} title="Next">
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Booking Information */}
              {manualStep === 2 && (
                <div className="boarding-manual-section">
                  <h4 className="boarding-manual-subtitle">Booking Information</h4>
                  <p className="boarding-manual-desc">
                    Please present passenger’s ID for manual confirmation.
                  </p>

                  <div className="boarding-manual-grid">
                    {/* (unchanged fields) */}
                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Booking ID</label>
                        <input
                          className={
                            "boarding-manual-input " + (manualErrors.bookingID ? "boarding-field-error" : "")
                          }
                          placeholder="Booking ID"
                          value={manualData.bookingID}
                          onChange={(e) => setManualData((v) => ({ ...v, bookingID: e.target.value }))}
                        />
                      </div>
                      {manualErrors.bookingID && (
                        <div className="boarding-error-text">{manualErrors.bookingID}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">User ID</label>
                        <input
                          className={
                            "boarding-manual-input " + (manualErrors.userID ? "boarding-field-error" : "")
                          }
                          placeholder="User ID"
                          value={manualData.userID}
                          onChange={(e) => setManualData((v) => ({ ...v, userID: e.target.value }))}
                        />
                      </div>
                      {manualErrors.userID && (
                        <div className="boarding-error-text">{manualErrors.userID}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">QR Code ID (optional)</label>
                        <input
                          className={
                            "boarding-manual-input " + (manualErrors.qrCodeID ? "boarding-field-error" : "")
                          }
                          placeholder="Qr Code ID (optional)"
                          value={manualData.qrCodeID}
                          onChange={(e) => setManualData((v) => ({ ...v, qrCodeID: e.target.value }))}
                        />
                      </div>
                      {manualErrors.qrCodeID && (
                        <div className="boarding-error-text">{manualErrors.qrCodeID}</div>
                      )}
                    </div>

                    <div className="boarding-manual-span2">
                      <div className="boarding-field">
                        <label className="boarding-field-label">Origin</label>
                        <select
                          className={
                            "boarding-manual-input boarding-manual-select " +
                            (manualErrors.origin ? "boarding-field-error" : "")
                          }
                          value={manualData.origin}
                          onChange={(e) => {
                            const origin = e.target.value;
                            const next = {
                              ...manualData,
                              origin,
                              destination: manualData.destination === origin ? "" : manualData.destination,
                            };
                            const fare = getFare(origin, next.destination);
                            setManualData({
                              ...next,
                              paidAmount: fare === "" ? "" : Number(fare).toFixed(2),
                            });
                          }}
                        >
                          <option value="" disabled>
                            Select Origin
                          </option>
                          {STATIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      {manualErrors.origin && (
                        <div className="boarding-error-text">{manualErrors.origin}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Destination</label>
                        <select
                          className={
                            "boarding-manual-input boarding-manual-select " +
                            (manualErrors.destination ? "boarding-field-error" : "")
                          }
                          value={manualData.destination}
                          onChange={(e) => {
                            const destination = e.target.value;
                            const fare = getFare(manualData.origin, destination);
                            setManualData((v) => ({
                              ...v,
                              destination,
                              paidAmount: fare === "" ? "" : Number(fare).toFixed(2),
                            }));
                          }}
                        >
                          <option value="" disabled>
                            Select Destination
                          </option>
                          {STATIONS.filter((s) => s !== manualData.origin).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      {manualErrors.destination && (
                        <div className="boarding-error-text">{manualErrors.destination}</div>
                      )}
                    </div>

                    <div className="boarding-manual-span2">
                      <div className="boarding-field">
                        <label className="boarding-field-label">Departure Date</label>
                        <input
                          type="date"
                          className={
                            "boarding-manual-input boarding-manual-date " +
                            (manualErrors.departureDate ? "boarding-field-error" : "")
                          }
                          value={manualData.departureDate}
                          onChange={(e) => setManualData((v) => ({ ...v, departureDate: e.target.value }))}
                        />
                      </div>
                      {manualErrors.departureDate && (
                        <div className="boarding-error-text">{manualErrors.departureDate}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Departure Time</label>
                        <select
                          className={
                            "boarding-manual-input boarding-manual-select " +
                            (manualErrors.departureTime ? "boarding-field-error" : "")
                          }
                          value={manualData.departureTime}
                          onChange={(e) => setManualData((v) => ({ ...v, departureTime: e.target.value }))}
                        >
                          <option value="" disabled>
                            Select Departure Time
                          </option>
                          {DEPARTURE_SCHEDULES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      {manualErrors.departureTime && (
                        <div className="boarding-error-text">{manualErrors.departureTime}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Paid At</label>
                        <input
                          className={
                            "boarding-manual-input " + (manualErrors.paidAt ? "boarding-field-error" : "")
                          }
                          placeholder="Paid At (e.g., 8:10 am)"
                          value={manualData.paidAt}
                          onChange={(e) => setManualData((v) => ({ ...v, paidAt: e.target.value }))}
                        />
                      </div>
                      {manualErrors.paidAt && (
                        <div className="boarding-error-text">{manualErrors.paidAt}</div>
                      )}
                    </div>

                    <div className="boarding-manual-span2">
                      <div className="boarding-field">
                        <label className="boarding-field-label">Booking Status</label>
                        <input
                          className={
                            "boarding-manual-input " +
                            (manualErrors.bookingStatus ? "boarding-field-error" : "")
                          }
                          placeholder="Booking Status"
                          value={manualData.bookingStatus}
                          readOnly
                        />
                      </div>
                      {manualErrors.bookingStatus && (
                        <div className="boarding-error-text">{manualErrors.bookingStatus}</div>
                      )}
                    </div>

                    <div>
                      <div className="boarding-field">
                        <label className="boarding-field-label">Booking Source</label>
                        <input
                          className={
                            "boarding-manual-input " +
                            (manualErrors.bookingSource ? "boarding-field-error" : "")
                          }
                          placeholder="Booking Source"
                          value={manualData.bookingSource}
                          readOnly
                        />
                      </div>
                      {manualErrors.bookingSource && (
                        <div className="boarding-error-text">{manualErrors.bookingSource}</div>
                      )}
                    </div>
                  </div>

                  <div className="wizard-actions-split">
                    <button
                      className="boarding-modal-btn boarding-modal-cancel"
                      onClick={() => setManualStep(1)}
                    >
                      Back
                    </button>
                    <button
                      className="boarding-manual-next"
                      onClick={onManualNext}
                      aria-disabled={!isManualValid}
                      title={!isManualValid ? "Fill all fields correctly to continue" : "Next"}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Payment (big total only) */}
              {manualStep === 3 && (
                <div className="boarding-manual-section">
                  <h4 className="boarding-manual-subtitle">Payment</h4>
                  <p className="boarding-manual-desc">
                    The fare is automatically calculated from origin/destination.
                  </p>

                  <div
                    style={{
                      border: "2px solid #111",
                      borderRadius: 10,
                      padding: "18px 22px",
                      background: "#fff",
                      textAlign: "center",
                      marginTop: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontSize: 16, color: "#374151", fontWeight: 700 }}>
                      Total Amount
                    </div>
                    <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.1 }}>
                      ₱ {manualData.paidAmount || "0.00"}
                    </div>
                  </div>

                  <div className="wizard-actions-split">
                    <button
                      className="boarding-modal-btn boarding-modal-cancel"
                      onClick={() => setManualStep(2)}
                    >
                      Back
                    </button>
                    <button
                      className="boarding-manual-next"
                      onClick={() => {
                        const errs = validatePayment(manualData);
                        setManualErrors(errs);
                        if (Object.keys(errs).length > 0) return;
                        // mark as paid and stamp time, then proceed to QR
                        setManualData((v) => ({
                          ...v,
                          paymentStatus: "P",
                          paidAt: toHmma(new Date()),
                        }));
                        // ensure QR is ready
                        if (!manualData.qrCodeID) {
                          const newQR = generateUniqueQR();
                          setManualData((v) => ({ ...v, qrCodeID: newQR }));
                        }
                        setManualErrors({});
                        setManualStep(4);
                      }}
                      title="Received Payment"
                    >
                      Received Payment
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: QR Code (BIGGER + Printable) */}
              {manualStep === 4 && (
                <div className="boarding-manual-section">
                  <h4 className="boarding-manual-subtitle">QR Code</h4>
                  <p className="boarding-manual-desc">
                    A ticket QR has been generated by the system for this booking.
                  </p>

                  {/* Printable ticket area */}
                  <div id="qr-print" ref={qrPrintRef} className="qr-ticket">
                    <div className="qr-ticket__header">
                      <div className="qr-ticket__title">Nervalós Ferry — Boarding Pass</div>
                      <div className="qr-ticket__meta">
                        <span>Date: {manualData.departureDate || "—"}</span>
                        <span>Time: {manualData.departureTime || "—"}</span>
                      </div>
                    </div>

                    <div className="qr-ticket__body">
                      <div className="qr-faux">
                        <div className="qr-square qr-square--lg" aria-hidden="true">
                          QR
                        </div>
                      </div>

                      <div className="qr-lines qr-lines--lg">
                        <div>
                          Passenger:{" "}
                          <strong>
                            {passengerInfo.firstName} {passengerInfo.lastName}
                          </strong>
                        </div>
                        <div>
                          Ticket Code: <strong>{manualData.qrCodeID}</strong>
                        </div>
                        <div>
                          From: <strong>{manualData.origin || "—"}</strong>
                        </div>
                        <div>
                          Destination: <strong>{manualData.destination || "—"}</strong>
                        </div>
                        <div>
                          Paid Amount: <strong>₱ {manualData.paidAmount || "0.00"}</strong>
                        </div>
                        <div>
                          Payment Status: <strong>{manualData.paymentStatus}</strong>
                        </div>
                        <div>
                          Source: <strong>{passengerInfo.platformSource}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="qr-ticket__footer">
                      <div className="qr-ticket__note">
                        Please present this ticket upon boarding.
                      </div>
                    </div>
                  </div>

                  <div className="wizard-actions-split">
                    <button
                      className="boarding-modal-btn boarding-modal-cancel"
                      onClick={() => setManualStep(3)}
                    >
                      Back
                    </button>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="boarding-modal-btn" onClick={printQR} title="Print or save as PDF">
                        Print Ticket (PDF)
                      </button>
                      <button className="boarding-manual-next" onClick={onManualNext} title="Finish">
                        Finish
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                <div>
                  User ID: <strong>{addedManual && addedManual.userID}</strong>
                </div>
                <div>
                  Ticket Code: <strong>{addedManual && addedManual.qrCodeID}</strong>
                </div>
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
                  <p className="boarding-scan-hint">If scanning doesn't work, use manual.</p>
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
                    <div className="boarding-scan-line">
                      From: {(scanResult && scanResult.from) || "—"}
                    </div>
                    <div className="boarding-scan-line">
                      Destination: {(scanResult && scanResult.to) || "—"}
                    </div>
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
