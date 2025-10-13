import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

const apiUrl = import.meta.env.VITE_API_URL;

export default function DisembarkPassengerTable({ destination }) {
  const [passengerData, setPassengerData] = useState([]);  // Ensure it's initialized as an empty array
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetching disembarking data based on destination
  const fetchDisembarkingData = useCallback(async (page) => {
    if (!destination) return;

    setLoading(true);
    try {
      const params = { page, destination }; // Pass destination to filter passengers
      if (query) params.query = query;
      const response = await axios.get(`${apiUrl}/api/passengertable/get_disembarking_details`, { params });

      // Use the response to set passenger data
      if (response.data && Array.isArray(response.data.boardingData)) {
        setPassengerData(response.data.boardingData);
        setTotalPages(response.data.totalPages);
      } else {
        setPassengerData([]); // Set empty array if data is invalid
      }
    } catch (error) {
      console.error("Error fetching disembarking data:", error);
      setPassengerData([]); // Handle error and reset data
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

  const handleDisembark = async (passengerId, qrcodeId) => {
    try {
      const response = await axios.post(`${apiUrl}/api/passengertable/update_passenger_status_and_qrcode`, {
        BD_ID: passengerId,
        action: 'accept',  // Mark as disembark (boarded)
        Qrcode_ID: qrcodeId,
      });

      console.log("Response:", response);  // Debugging: Check what is returned from the backend

      // Check if the response contains a message
      if (response.data && response.data.message) {
        console.log(response.data.message);  // Log the success message

        // Update passenger status locally
        setPassengerData(prevData =>
          prevData.map(passenger =>
            passenger.BD_ID === passengerId
              ? { ...passenger, status: 'D' }  // Change status to Disembarked
              : passenger
          )
        );
      } else {
        console.error("No message returned from the server");
      }
    } catch (error) {
      console.error("Error updating passenger status:", error);
    }
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
                      <button className="actionbtn" onClick={() => handleDisembark(passenger.BD_ID, passenger.Qrcode_ID)}>Mark as Disembark</button>
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
    </>
  );
}
