import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_boarding.css";

import { getParams } from "../modules/boarding_shared.jsx";
import ManualBookingModal from "../modules/ManualBooking/ManualBookingModal.jsx";
import PassengerTable from "../modules/PassengerTable.jsx";
import ScanButtonModule from "../modules/ScanButtonModule.jsx";

const apiUrl = import.meta.env.VITE_API_URL;

export function Boarding() {
  const qp = getParams();

  // ---- scheduleId extraction that works with BrowserRouter AND HashRouter
  const scheduleId = useMemo(() => {
    try {
      const hash = window.location.hash || "";              // e.g. "#/station-boarding/ABC123?x=1"
      const hashPath = hash.startsWith("#") ? hash.slice(1) : hash;
      const base = hashPath || window.location.pathname || ""; // prefer hash path if present
      const pathOnly = base.split("?")[0];                  // strip query
      const parts = pathOnly.split("/").filter(Boolean);    // ["station-boarding","ABC123"]
      const last = parts[parts.length - 1] || "";
      const id = decodeURIComponent(last);
      console.debug("[Boarding] scheduleId parsed =", id, "from base =", base);
      return id;
    } catch (e) {
      console.warn("[Boarding] scheduleId parse failed:", e);
      return "";
    }
  }, []);

  // ---------------------- server data for the route card ----------------------
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [stops, setStops] = useState([]);

  // ref to auto-scroll the current stop into view
  const currentStopRef = useRef(null);

  // ---------------------- existing (demo) passenger table ---------------------
  const [passengerList, setPassengerList] = useState([
    { bookingID:"BID009212", userID:"UID002489", qrCodeID:"TC00203", origin:"Escolta", destination:"Guadalupe", departureDate:"2025/06/12", departureTime:"8:00 am", paymentStatus:"P", paidAmount:45.0, paidAt:"8:00 am", bookingStatus:"OB", bookingSource:"MA" },
    { bookingID:"BID009432", userID:"UID762571", qrCodeID:"TC00204", origin:"Quinta", destination:"Lambingan", departureDate:"2025/06/12", departureTime:"8:22 am", paymentStatus:"P", paidAmount:30.0, paidAt:"8:00 am", bookingStatus:"OB", bookingSource:"MA" },
    { bookingID:"BID021353", userID:"UID638193", qrCodeID:"TC00445", origin:"Escolta", destination:"Valenzuela", departureDate:"2025/06/12", departureTime:"8:40 am", paymentStatus:"P", paidAmount:40.0, paidAt:"8:10 am", bookingStatus:"CO", bookingSource:"CB" },
    { bookingID:"BID032212", userID:"UID078263", qrCodeID:"TC08798", origin:"Escolta", destination:"Guadalupe", departureDate:"2025/06/12", departureTime:"8:50 am", paymentStatus:"P", paidAmount:45.0, paidAt:"8:10 am", bookingStatus:"CO", bookingSource:"MA" },
    { bookingID:"BID024712", userID:"UID012861", qrCodeID:"TC06594", origin:"Lambingan", destination:"Kalawaan", departureDate:"2025/06/12", departureTime:"—", paymentStatus:"PG", paidAmount:38.0, paidAt:"8:38 am", bookingStatus:"PE", bookingSource:"CB" },
    { bookingID:"BID009123", userID:"UID097260", qrCodeID:"TC09836", origin:"Sta. Ana", destination:"Guadalupe", departureDate:"2025/06/12", departureTime:"—", paymentStatus:"PG", paidAmount:20.0, paidAt:"8:40 am", bookingStatus:"PE", bookingSource:"GM" },
    { bookingID:"BID012563", userID:"UID897217", qrCodeID:"TC04764", origin:"Lawton", destination:"Hulo", departureDate:"2025/06/12", departureTime:"—", paymentStatus:"F",  paidAmount:0.0,  paidAt:"8:42 am", bookingStatus:"CA", bookingSource:"MA" },
    { bookingID:"BID322112", userID:"UID212414", qrCodeID:"TC09894", origin:"Escolta", destination:"Quinta", departureDate:"2025/06/12", departureTime:"—", paymentStatus:"P",  paidAmount:30.0, paidAt:"8:00 am", bookingStatus:"DI", bookingSource:"MB" },
  ]);

  const [showManual, setShowManual] = useState(false);

  // ---------------------- helpers ----------------------
  const tokenHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: token ? `Bearer ${token}` : "", "Content-Type": "application/json" };
  };

  const to12h = (hhmmssOrDisplay) => {
    if (!hhmmssOrDisplay) return "";
    if (/[AP]M$/i.test(hhmmssOrDisplay.trim())) return hhmmssOrDisplay; // already 12h
    const [hStr = "0", mStr = "00"] = String(hhmmssOrDisplay).split(":");
    const h = parseInt(hStr, 10) || 0;
    const m = (mStr ?? "00").padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = (h % 12) || 12;
    return `${h12}:${m} ${ampm}`;
  };

  // ---------------------- load route card data ----------------------
  useEffect(() => {
    if (!scheduleId) {
      setError("Missing scheduleId in URL. If using HashRouter, ensure path looks like #/station-boarding/<id>");
      return;
    }
    setLoading(true);
    setError("");

    const dateParam = qp.date || new Date().toISOString().split("T")[0];
    const url = `${apiUrl}/api/boarding/routecard/${encodeURIComponent(scheduleId)}?date=${encodeURIComponent(dateParam)}`;
    console.debug("[Boarding] Fetch routecard:", url);

    fetch(url, { headers: tokenHeaders() })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return body;
      })
      .then((payload) => {
        console.debug("[Boarding] routecard payload:", payload);
        setScheduleInfo(payload?.schedule_info || null);
        setStops(Array.isArray(payload?.stops) ? payload.stops : []);
      })
      .catch((e) => setError(e.message || "Failed to load route card"))
      .finally(() => setLoading(false));
  }, [scheduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------- compute header display ----------------------
  const headerTime = useMemo(() => {
    const t = scheduleInfo?.departure_time || qp.time;
    return to12h(t);
  }, [scheduleInfo, qp.time]);

  const headerBoarded = useMemo(() => {
    if (scheduleInfo?.boarded_seats != null) return scheduleInfo.boarded_seats;
    return Number.isFinite(qp.boarded) ? qp.boarded : Math.max(0, qp.total - qp.avail);
  }, [scheduleInfo, qp.boarded, qp.total, qp.avail]);

  const headerTotal = useMemo(() => {
    if (scheduleInfo?.total_seats != null) return scheduleInfo.total_seats;
    return qp.total;
  }, [scheduleInfo, qp.total]);

  const headerPath = useMemo(() => {
    const dir = (scheduleInfo?.direction || qp.dir || "forward").toUpperCase();
    const routeOrStation = scheduleInfo?.route_name || qp.station || "";
    return `${routeOrStation} — ${dir} DIRECTION`;
  }, [scheduleInfo, qp.dir, qp.station]);

  const currentStopName = scheduleInfo?.station_name || qp.station || "";
  const currentStopOrder = scheduleInfo?.stop_order ?? null;

  // auto-scroll the current stop into view when stops or current change
  useEffect(() => {
    if (currentStopRef.current) {
      currentStopRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [stops, currentStopOrder, currentStopName]);

  // ---------------------- actions for demo table ----------------------
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

  // ESC closes modals (manual)
  useEffect(() => {
    if (!showManual) return;
    const onKey = (e) => e.key === "Escape" && setShowManual(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showManual]);

  // render a status per stop relative to current stop
  const stopStatus = (stopOrder) => {
    if (currentStopOrder == null) return "";
    if (stopOrder < currentStopOrder) return "Departed";
    if (stopOrder === currentStopOrder) return "Arrived";
    return "Approaching";
  };

  const stopTimeToDisplay = (s) => {
    // prefer backend "stop_time", else "time", else empty
    return to12h(s.stop_time || s.time || "");
  };

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
                <div className="route-card__path">{headerPath}</div>
                <div className="route-card__time">
                  {loading ? "Loading..." : headerTime || "—"}
                </div>
                <div className="route-card__boarded">
                  Boarded:{" "}
                  <strong>
                    {loading ? "…" : headerBoarded}/{loading ? "…" : headerTotal}
                  </strong>
                </div>
              </div>

              <div className="stops-list">
                {error && (
                  <div className="stop-row">
                    <span className="stop-name" style={{ color: "red" }}>
                      {error}
                    </span>
                  </div>
                )}

                {!error && loading && (
                  <div className="stop-row">
                    <span className="stop-name">Loading stops…</span>
                  </div>
                )}

                {!error && !loading && (stops.length ? (
                  stops.map((s) => {
                    const isCurrent =
                      (s.station_name || "").toLowerCase() === (currentStopName || "").toLowerCase();
                    const timeStr = stopTimeToDisplay(s) || "—";
                    const statusStr = stopStatus(Number(s.stop_order ?? 0));
                    return (
                      <div
                        className={"stop-row" + (isCurrent ? " is-current" : "")}
                        key={`${s.station_id}-${s.stop_order}`}
                        ref={isCurrent ? currentStopRef : null}
                      >
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
                        <span className="stop-name">{s.station_name}</span>
                        <span className="stop-time">{timeStr}</span>
                        <span className="status">{statusStr}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="stop-row">
                    <span className="stop-name">
                      No stops found for this route. Check your <code>RouteStations</code> and that
                      the backend is returning <code>stop_time</code> per stop.
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* END ROUTE CARD */}
          </div>

          <LogoutButton />
        </header>

        {/* Buttons */}
        <section className="actions-bar">
          <ScanButtonModule passengerList={passengerList} />
          <button className="manual-booking-btn" onClick={() => setShowManual(true)}>
            <span className="btn-icon">📝</span>
            Manual Booking
          </button>
        </section>

        {/* Passenger Table (still demo data for now) */}
        <PassengerTable rows={passengerList} onAccept={handleAccept} onCancel={handleCancel} />
      </div>

      {/* Manual Booking Modal */}
      <ManualBookingModal
        open={showManual}
        onClose={() => setShowManual(false)}
        existingRows={passengerList}
        addPassengerRow={(row) => {
          setPassengerList((prev) => [...prev, row]);
          setShowManual(false);
        }}
      />
    </div>
  );
}
