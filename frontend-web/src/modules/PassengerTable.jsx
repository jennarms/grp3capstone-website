// ===============================
// PassengerTable.jsx (FIXED)
// ===============================
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL;

export default function PassengerTable({ origin, scheduleTime }) {
  const [passengerData, setPassengerData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");

  // 🔥 useRef to STOP flicker (loading message never hides table)
  const loadingRef = useRef(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [modalMessage, setModalMessage] = useState("");

  // --------------------------------------------------
  // HANDLE ACCEPT / CANCEL
  // --------------------------------------------------
  const handleAction = async (action, passengerId, qrcodeId) => {
    try {
      await axios.post(`${apiUrl}/api/passengertable/update_passenger_status_and_qrcode`, {
        BD_ID: passengerId,
        action,
        Qrcode_ID: qrcodeId,
      });

      // Update instantly
      setPassengerData((prev) =>
        prev.map((p) =>
          p.BD_ID === passengerId
            ? { ...p, status: action === "accept" ? "B" : "C" }
            : p
        )
      );
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      closeModal();
    }
  };

  const openModal = (action, passenger) => {
    if (action === "accept" && passenger.status === "B") {
      setModalMessage("This passenger is already boarded.");
      setModalAction(null);
    } else if (action === "cancel" && passenger.status === "B") {
      setModalMessage("You cannot cancel a boarded passenger.");
      setModalAction(null);
    } else {
      setModalMessage(`Are you sure you want to ${action} this passenger?`);
      setModalAction(action);
    }
    setSelectedPassenger(passenger);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalAction(null);
    setSelectedPassenger(null);
    setModalMessage("");
  };

  const confirmModalAction = () => {
    if (modalAction && selectedPassenger) {
      handleAction(modalAction, selectedPassenger.BD_ID, selectedPassenger.Qrcode_ID);
    }
  };

  // --------------------------------------------------
  // FETCH BOARDING DATA (NO FLICKER)
  // --------------------------------------------------
  const fetchBoardingData = useCallback(async () => {
    if (!origin || !scheduleTime) return;

    const formatTime = (t) => {
      const [h, m] = t.split(":");
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`;
    };

    loadingRef.current = true;

    try {
      const params = {
        page: currentPage,
        origin,
        schedule_time: formatTime(scheduleTime),
      };

      if (query) params.query = query;

      const res = await axios.get(`${apiUrl}/api/passengertable/get_boarding_details`, { params });

      setPassengerData(res.data.boardingData || []);
      setTotalPages(res.data.totalPages || 0);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      // 🔥 Do NOT trigger UI flicker — just silently finish
      loadingRef.current = false;
    }
  }, [origin, scheduleTime, query, currentPage]);

  // Initial load
  useEffect(() => {
    fetchBoardingData();
  }, [fetchBoardingData]);

  // Auto refresh every 10 seconds but NO remount / NO glitch
  useEffect(() => {
    const id = setInterval(() => {
      fetchBoardingData();
    }, 10000);

    return () => clearInterval(id);
  }, [fetchBoardingData]);

  // --------------------------------------------------
  // Remove expired dates AND status D
  // --------------------------------------------------
  const isExpired = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);

    return d < today;
  };

  const activePassengers = passengerData.filter(
    (p) => !isExpired(p.departure_date) && p.status !== "D"
  );

  // --------------------------------------------------
  // SEARCH
  // --------------------------------------------------
  const normalize = (v) => String(v || "").toLowerCase();

  const filteredData = activePassengers.filter((p) => {
    const q = query.toLowerCase();
    return Object.values(p).some((v) => normalize(v).includes(q));
  });

  return (
    <>
      {/* HEADER */}
      <section className="passenger-head-section">
        <div className="table-header">
          <h3>Passenger List</h3>
          <div className="table-search">
            <input
              className="table-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search passenger"
            />
          </div>
        </div>
      </section>

      {/* TABLE */}
      <section className="boarding-table-section">
        <div className="table-wrapper">
          {filteredData.length === 0 ? (
            <div className="no-data-message">No passengers available.</div>
          ) : (
            <table className="passenger-list-table">
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
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredData.map((p) => (
                  <tr key={p.BD_ID}>
                    <td>{p.BD_ID}</td>
                    <td>{p.Booking_ID}</td>
                    <td>{p.User_ID}</td>
                    <td>{p.boarding_time || "—"}</td>
                    <td>{p.disembarking_time || "—"}</td>
                    <td>{p.status}</td>
                    <td>{p.Qrcode_ID}</td>
                    <td>{p.Schedule_ID || "—"}</td>
                    <td>{p.origin}</td>
                    <td>{p.destination}</td>
                    <td>{p.departure_date}</td>
                    <td>{p.departure_time}</td>

                    <td>
                      {p.status === "B" ? (
                        <span>Already Boarded</span>
                      ) : p.status === "C" ? (
                        <span>Cancelled</span>
                      ) : (
                        <>
                          <button className="actionbtn" onClick={() => openModal("accept", p)}>
                            Accept
                          </button>
                          <button className="actionbtn" onClick={() => openModal("cancel", p)}>
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* PAGINATION */}
      <div className="pagination">
        <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
          Prev
        </button>
        <span>{currentPage}</span>
        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
          Next
        </button>
      </div>

      {/* MODAL */}
      {modalVisible && (
        <div className="actionbtn-modal-confirm-overlay">
          <div className="actionbtn-modal-confirm-box">
            <h3>{modalAction === "accept" ? "Confirm Accept" : "Confirm Cancel"}</h3>
            <p>{modalMessage}</p>
            <div className="actionbtn-modal-confirm-buttons">
              <button onClick={closeModal}>Cancel</button>
              <button onClick={confirmModalAction}>Yes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
