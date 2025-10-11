import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

const apiUrl = import.meta.env.VITE_API_URL;

export default function PassengerTable({ origin, scheduleTime }) {
  const [passengerData, setPassengerData] = useState([]); // Data from the backend
  const [currentPage, setCurrentPage] = useState(1);  // For pagination
  const [totalPages, setTotalPages] = useState(0);  // Total number of pages
  const [query, setQuery] = useState("");  // For search functionality

  // Handle actions (accept or cancel)
  const handleAction = (action, passengerId) => {
    if (action === "accept") {
      console.log("Accepted passenger with ID:", passengerId);
    } else if (action === "cancel") {
      console.log("Cancelled passenger with ID:", passengerId);
    }
  };

  // Fetch boarding data from the backend based on current page and query
  const fetchBoardingData = useCallback(async (page) => {
    console.log(`Origin: ${origin}, Schedule Time: ${scheduleTime}`);

    // Validation: Ensure both origin and scheduleTime are provided
    if (!origin || !scheduleTime) {
      console.error("Missing origin or schedule time!");
      return;  // Prevent API call if parameters are missing
    }

    try {
      const response = await axios.get(`${apiUrl}/api/passengertable/get_boarding_details`, {
        params: { 
          page, 
          query, 
          origin,       // Pass the origin (station)
          schedule_time: scheduleTime  // Pass the selected schedule time
        }, 
      });

      console.log("API response:", response.data); // Check the response

      setPassengerData(response.data.boardingData);
      setTotalPages(response.data.totalPages);  // Set the total number of pages
    } catch (error) {
      console.error("Error fetching boarding data:", error);
    }
  }, [origin, scheduleTime, query]);  // Add dependencies

  useEffect(() => {
    console.log('Loading boarding data...');
    fetchBoardingData(currentPage);  // Fetch data when the page or query changes
  }, [currentPage, fetchBoardingData]);

  const handlePageChange = (direction) => {
    if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    } else if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
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
              {passengerData.length > 0 ? (
                passengerData.map((passenger) => (
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
                      <button onClick={() => handleAction('accept', passenger.BD_ID)}>Accept</button>
                      <button onClick={() => handleAction('cancel', passenger.BD_ID)}>Cancel</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="13">No passengers available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pagination Controls */}
      <div className="pagination">
        <button
          disabled={currentPage === 1}
          onClick={() => handlePageChange('prev')}
        >
          Prev
        </button>
        <span>{currentPage}</span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange('next')}
        >
          Next
        </button>
      </div>
    </>
  );
}
