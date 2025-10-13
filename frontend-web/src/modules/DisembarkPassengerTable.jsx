import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

const apiUrl = import.meta.env.VITE_API_URL;

export default function DisembarkPassengerTable({ destination }) {
  const [passengerData, setPassengerData] = useState([]);  // Ensure it's initialized as an empty array
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

  // Fetching disembarking data based on destination
  const fetchDisembarkingData = useCallback(async (page) => {
    if (!destination) return;

    setLoading(true);
    try {
      const params = { page, destination }; // Pass destination to filter passengers
      if (query) params.query = query;
      const response = await axios.get(`${apiUrl}/api/passengertable/get_disembarking_details`, { params });

      console.log('API Response:', response.data);  // Debugging: Log the full response to inspect structure

      // Check if the response contains the expected data
      if (response.data && Array.isArray(response.data.boardingData)) {
        setPassengerData(response.data.boardingData); // Set the passenger data correctly
        setTotalPages(response.data.totalPages);
      } else {
        console.error("Invalid API response structure:", response.data);
        setPassengerData([]); // Set empty array if the data structure is invalid
      }
    } catch (error) {
      console.error("Error fetching disembarking data:", error);
      setPassengerData([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [destination, query]);

  useEffect(() => { fetchDisembarkingData(currentPage); }, [currentPage, fetchDisembarkingData]);

  useEffect(() => {
    const interval = setInterval(() => { fetchDisembarkingData(currentPage); }, 10000);
    return () => clearInterval(interval);
  }, [currentPage, fetchDisembarkingData]);

  const handlePageChange = (direction) => {
    if (direction === 'prev' && currentPage > 1) setCurrentPage(currentPage - 1);
    else if (direction === 'next' && currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // Function to compare the departure date with the current date
  const isDateExpired = (departureDate) => {
    const today = new Date();
    const departure = new Date(departureDate);

    // Set the time to 00:00 to only compare the dates
    today.setHours(0, 0, 0, 0);
    departure.setHours(0, 0, 0, 0);

    // If the departure date is older than today, return true
    return departure < today;
  };

  const filteredData = passengerData.filter((passenger) => !isDateExpired(passenger.departure_date)); // Only show passengers that are not expired

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
                {filteredData.map((passenger) => (
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
