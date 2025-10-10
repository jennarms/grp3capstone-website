import axios from 'axios';
import { useEffect, useState } from 'react';

const apiUrl = import.meta.env.VITE_API_URL;

export default function PassengerTable({ origin, scheduleTime }) {
  const [passengerData, setPassengerData] = useState([]); // Data from the backend
  const [currentPage, setCurrentPage] = useState(1);  // For pagination
  const [totalPages, setTotalPages] = useState(0);  // Total number of pages
  const [query, setQuery] = useState("");  // For search functionality

  // Fetch boarding data from the backend based on current page and query
  const fetchBoardingData = async (page) => {
    try {
      const response = await axios.get(`${apiUrl}/api/passengertable/get_boarding_details`, {
        params: { 
          page, 
          query, 
          origin,       // Send the selected origin
          schedule_time: scheduleTime  // Send the selected schedule time
        }, 
      });

      setPassengerData(response.data.boardingData);
      setTotalPages(response.data.totalPages);  // Set the total number of pages
    } catch (error) {
      console.error("Error fetching boarding data:", error);
    }
  };

  // Load data when the page number or query changes
  useEffect(() => {
    fetchBoardingData(currentPage);
  }, [currentPage, query]);  // Re-run the effect whenever currentPage or query changes

  // Poll every 5 seconds to check for new updates (this will keep fetching new data)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBoardingData(currentPage);  // Keep fetching data periodically
    }, 5000); // 5 seconds

    // Clean up the interval when the component unmounts or stops fetching
    return () => clearInterval(interval);
  }, [currentPage]);

  // Handle actions like Accept or Cancel
  const handleAction = (action, passengerId) => {
    if (action === "accept") {
      // Handle Accept action
      console.log("Accepted passenger with ID:", passengerId);
    } else if (action === "cancel") {
      // Handle Cancel action
      console.log("Cancelled passenger with ID:", passengerId);
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
                  <td colSpan="13">No passengers available.</td> {/* Adjusted colSpan to 13 */}
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
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          Prev
        </button>
        <span>{currentPage}</span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
