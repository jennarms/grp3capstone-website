// ===============================
// DisembarkPassengerTable.jsx — FINAL, NO FLICKER
// ===============================
import axios from "axios";
import { useCallback, useEffect, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL;

export default function DisembarkPassengerTable({ destination }) {
  console.log("🚀 TABLE MOUNTED — destination =", destination);

  const [passengerData, setPassengerData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");

  const [initialLoad, setInitialLoad] = useState(true); // 🔥 NEW
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPassenger, setSelectedPassenger] = useState(null);

  // =========================================================
  // FETCH (NO FLICKER VERSION)
  // =========================================================
  const fetchDisembarkingData = useCallback(
    async (page) => {
      console.log("📌 FETCH CALLED — destination =", destination);

      if (
        !destination ||
        destination === "loading..." ||
        destination === "Failed to fetch station"
      ) {
        console.log("⛔ destination not ready");
        return;
      }

      try {
        if (initialLoad) setLoading(true); // 👈 Only show loading on FIRST load

        const params = { page, destination };
        if (query) params.query = query;

        const res = await axios.get(
          `${apiUrl}/api/passengertable/get_disembarking_details`,
          { params }
        );

        if (res.data?.boardingData) {
          setPassengerData(res.data.boardingData);
          setTotalPages(res.data.totalPages);
        }
      } catch (err) {
        console.error("❌ API ERROR:", err);
        setPassengerData([]);
      } finally {
        if (initialLoad) setInitialLoad(false); // Stop showing loading forever
        setLoading(false);
      }
    },
    [destination, query, initialLoad]
  );

  // Initial load / page change
  useEffect(() => {
    fetchDisembarkingData(currentPage);
  }, [currentPage, fetchDisembarkingData]);

  // Auto-refresh
  useEffect(() => {
    if (
      !destination ||
      destination === "loading..." ||
      destination === "Failed to fetch station"
    )
      return;

    const interval = setInterval(() => {
      fetchDisembarkingData(currentPage);
    }, 10000);

    return () => clearInterval(interval);
  }, [destination, currentPage, fetchDisembarkingData]);

  // Pagination
  const handlePageChange = (dir) => {
    if (dir === "prev" && currentPage > 1) setCurrentPage((p) => p - 1);
    if (dir === "next" && currentPage < totalPages) setCurrentPage((p) => p + 1);
  };

  // Modal controls
  const openModal = (p) => {
    setSelectedPassenger(p);
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedPassenger(null);
    setModalVisible(false);
  };

  const handleDisembark = async () => {
    try {
      if (!selectedPassenger) return;

      const res = await axios.post(
        `${apiUrl}/api/passengertable/update_passenger_status_and_qrcode`,
        {
          BD_ID: selectedPassenger.BD_ID,
          action: "disembark",
          Qrcode_ID: selectedPassenger.Qrcode_ID,
        }
      );

      if (res.data?.message) {
        setPassengerData((prev) =>
          prev.map((p) =>
            p.BD_ID === selectedPassenger.BD_ID
              ? {
                  ...p,
                  status: "D",
                  disembarking_time: new Date().toISOString(),
                }
              : p
          )
        );
      }
    } catch (err) {
      console.error("❌ Update Error:", err);
    } finally {
      closeModal();
    }
  };

  // Search filter
  const normalize = (v) => String(v || "").toLowerCase();
  const filteredData = passengerData.filter((p) =>
    Object.values(p).some((val) => normalize(val).includes(query.toLowerCase()))
  );

  return (
    <>
      {/* HEADER */}
      <section className="passenger-head-section">
        <div className="table-header">
          <h3>Passenger List (Disembark)</h3>
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
          {/* 🔥 REAL FIX — show loading ONLY once */}
          {initialLoad && loading ? (
            <div className="loading-message">Loading...</div>
          ) : filteredData.length === 0 ? (
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
                        <button className="actionbtn" onClick={() => openModal(p)}>
                          Mark as Disembark
                        </button>
                      ) : (
                        <span>Already Disembarked</span>
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
        <button disabled={currentPage === 1} onClick={() => handlePageChange("prev")}>
          Prev
        </button>
        <span>{currentPage}</span>
        <button disabled={currentPage === totalPages} onClick={() => handlePageChange("next")}>
          Next
        </button>
      </div>

      {/* MODAL */}
      {modalVisible && (
        <div className="actionbtn-modal-confirm-overlay">
          <div className="actionbtn-modal-confirm-box">
            <h3>Confirm Disembark</h3>
            <p>Are you sure you want to disembark this passenger?</p>

            <div className="actionbtn-modal-confirm-buttons">
              <button onClick={closeModal}>Cancel</button>
              <button onClick={handleDisembark}>Yes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
