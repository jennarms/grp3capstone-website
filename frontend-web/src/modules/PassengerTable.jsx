import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

const apiUrl = import.meta.env.VITE_API_URL;

export default function PassengerTable({ origin, scheduleTime }) {
  const [passengerData, setPassengerData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'accept' or 'cancel'
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [modalMessage, setModalMessage] = useState(""); // For custom message in modal

  const handleAction = async (action, passengerId, qrcodeId) => {
    try {
      const response = await axios.post(`${apiUrl}/api/passengertable/update_passenger_status_and_qrcode`, {
        BD_ID: passengerId,
        action: action,
        Qrcode_ID: qrcodeId,
      });

      console.log(response.data.message);

      // Update passenger status locally
      setPassengerData(prevData =>
        prevData.map(passenger =>
          passenger.BD_ID === passengerId
            ? { ...passenger, status: action === 'accept' ? 'B' : 'C' }
            : passenger
        )
      );
    } catch (error) {
      console.error("Error updating passenger status and QR Code:", error);
    } finally {
      closeModal();
    }
  };

  const openModal = (action, passenger) => {
    if (action === 'accept' && passenger.status === 'B') {
      setModalMessage("This passenger is already boarded. Cannot board again.");
      setModalAction(null);
    } else if (action === 'cancel' && passenger.status === 'B') {
      setModalMessage("You cannot cancel boarded passengers.");
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
    setModalMessage(""); // Clear message when modal is closed
  };

  const confirmModalAction = () => {
    if (selectedPassenger && modalAction) {
      handleAction(modalAction, selectedPassenger.BD_ID, selectedPassenger.Qrcode_ID);
    }
  };

  // Fetching boarding data (same as before)
  const fetchBoardingData = useCallback(async (page) => {
    if (!origin || !scheduleTime) return;

    const formatTime = (time) => {
      const [h, m] = time.split(":").map(Number);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    };

    setLoading(true);
    try {
      const params = { page, origin, schedule_time: formatTime(scheduleTime) };
      if (query) params.query = query;
      const response = await axios.get(`${apiUrl}/api/passengertable/get_boarding_details`, { params });
      setPassengerData(response.data.boardingData);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Error fetching boarding data:", error);
    } finally {
      setLoading(false);
    }
  }, [origin, scheduleTime, query]);

  useEffect(() => { fetchBoardingData(currentPage); }, [currentPage, fetchBoardingData]);
  useEffect(() => {
    const interval = setInterval(() => { fetchBoardingData(currentPage); }, 10000);
    return () => clearInterval(interval);
  }, [currentPage, fetchBoardingData]);

  const handlePageChange = (direction) => {
    if (direction === 'prev' && currentPage > 1) setCurrentPage(currentPage - 1);
    else if (direction === 'next' && currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <>
      <section className="passenger-head-section">
        <div className="table-header">
          <h3>Passenger List</h3>
          <div className="table-search" role="search">
            <input
              className="table-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search passenger"
            />
          </div>
        </div>
      </section>

      <section className="boarding-table-section">
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-message">Loading data...</div>
          ) : passengerData.length === 0 ? (
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
                {passengerData.map((passenger) => (
                  <tr key={passenger.BD_ID}>
                    <td>{passenger.BD_ID}</td>
                    <td>{passenger.Booking_ID}</td>
                    <td>{passenger.User_ID}</td>
                    <td>{passenger.boarding_time || '—'}</td>
                    <td>{passenger.disembarking_time || '—'}</td>
                    <td>{passenger.status || '—'}</td>
                    <td>{passenger.Qrcode_ID || '—'}</td>
                    <td>{passenger.Schedule_ID || '—'}</td>
                    <td>{passenger.origin || '—'}</td>
                    <td>{passenger.destination || '—'}</td>
                    <td>{passenger.departure_date || '—'}</td>
                    <td>{passenger.departure_time || '—'}</td>
                    <td>
                      <button className="actionbtn" onClick={() => openModal('accept', passenger)}>Accept</button>
                      <button className="actionbtn" onClick={() => openModal('cancel', passenger)}>Cancel</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="pagination">
        <button disabled={currentPage === 1} onClick={() => handlePageChange('prev')}>Prev</button>
        <span>{currentPage}</span>
        <button disabled={currentPage === totalPages} onClick={() => handlePageChange('next')}>Next</button>
      </div>

      {/* Modal */}
      {modalVisible && (
        <div className="actionbtn-modal-confirm-overlay">
          <div className="actionbtn-modal-confirm-box">
            <h3>{modalAction === 'accept' ? 'Confirm Accept' : 'Confirm Cancel'}</h3>
            <p>{modalMessage}</p>
            <div className="actionbtn-modal-confirm-buttons">
              <button className="actionbtn-modal-cancel-btn" onClick={closeModal}>Cancel</button>
              <button className="actionbtn-modal-yes-btn" onClick={confirmModalAction}>Yes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
