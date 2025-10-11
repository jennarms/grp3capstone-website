import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

const apiUrl = import.meta.env.VITE_API_URL;

export default function PassengerTable({ origin, scheduleTime }) {
  const [passengerData, setPassengerData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAction = (action, passengerId) => {
    if (action === "accept") {
      console.log("Accepted passenger with ID:", passengerId);
    } else if (action === "cancel") {
      console.log("Cancelled passenger with ID:", passengerId);
    }
  };

 const fetchBoardingData = useCallback(async (page) => {
  setLoading(true);

  console.log(`Origin: ${origin}, Schedule Time: ${scheduleTime}, Query: ${query}`);

  if (!origin || !scheduleTime) {
    console.error("Missing origin or schedule time!");
    return;
  }

  // Function to format the schedule time as HH:mm:ss with leading zeroes
  const formatTime = (time) => {
    const [h, m] = time.split(":").map(Number);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  };

  try {
    const params = {
      page,
      origin,
      schedule_time: formatTime(scheduleTime), // Format the schedule time to HH:mm:ss
    };

    if (query) {
      params.query = query;
    }

    const response = await axios.get(`${apiUrl}/api/passengertable/get_boarding_details`, { params });
    console.log("API response:", response.data);

    setPassengerData(response.data.boardingData);
    setTotalPages(response.data.totalPages);
  } catch (error) {
    console.error("Error fetching boarding data:", error);
  } finally {
    setLoading(false);
  }
}, [origin, scheduleTime, query]);


  useEffect(() => {
    console.log('Loading boarding data...');
    fetchBoardingData(currentPage);
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
          {loading ? (
            <div className="loading-message">Loading data...</div>
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
          )}
        </div>
      </section>

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
