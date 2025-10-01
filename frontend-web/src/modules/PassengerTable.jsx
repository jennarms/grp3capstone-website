import { useEffect, useMemo, useState } from "react";

export default function PassengerTable() {
  const [query, setQuery] = useState("");
  const [passengers, setPassengers] = useState([]);

  useEffect(() => {
    // Fetch passengers from backend
    const fetchPassengers = async () => {
      const response = await fetch(`/api/passengertable/get_passenger_table?station_id=1&schedule_id=1`);
      const data = await response.json();
      setPassengers(data.passengers); // Set passengers in state
    };

    fetchPassengers();
  }, []);

  // Filter passengers based on search query
  const finalFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return passengers;
    return passengers.filter((p) =>
      Object.values(p).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [query, passengers]);

  // Map booking status to CSS class for styling
  const bookingStatusClass = (s) => {
    switch (s) {
      case "OB": return "status-badge status-ob"; // Boarded
      case "CO": return "status-badge status-co"; // Cancelled
      case "PE": return "status-badge status-pe"; // Pending
      case "CA": return "status-badge status-ca"; // Cancelled
      case "DI": return "status-badge status-di"; // Disembarked
      default: return "status-badge";
    }
  };

  // Handle Accept booking (update status to 'Boarded')
  const handleAccept = async (bookingID) => {
    const response = await fetch('/api/passengertable/accept_booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingID })
    });

    if (response.ok) {
      setPassengers(prev => prev.map(p => p.Booking_ID === bookingID ? { ...p, status: 'B' } : p));
    }
  };

  // Handle Cancel booking (update status to 'Cancelled')
  const handleCancel = async (bookingID) => {
    const response = await fetch('/api/passengertable/cancel_booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingID })
    });

    if (response.ok) {
      setPassengers(prev => prev.map(p => p.Booking_ID === bookingID ? { ...p, status: 'C' } : p));
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
                <th>Name</th><th>BD_ID</th><th>Booking_ID</th><th>Station_ID</th>
                <th>boarding_time</th><th>disembarking_time</th><th>status</th><th>Qrcode_ID</th><th>actions</th>
              </tr>
            </thead>
            <tbody>
              {finalFiltered.map((p) => (
                <tr key={p.Booking_ID}>
                  <td>{p.name}</td>
                  <td>{p.BD_ID}</td>
                  <td>{p.Booking_ID}</td>
                  <td>{p.Station_ID}</td>
                  <td>{p.boardingTime}</td>
                  <td>{p.disembarkingTime}</td>
                  <td><span className={bookingStatusClass(p.status)}>{p.status}</span></td>
                  <td>{p.Qrcode_ID}</td>
                  <td>
                    {p.status === "PE" ? (
                      <div className="action-cell">
                        <button onClick={() => handleAccept(p.Booking_ID)}>Accept</button>
                        <button onClick={() => handleCancel(p.Booking_ID)}>Cancel</button>
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
