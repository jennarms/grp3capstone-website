import { useEffect, useState } from "react";
import { StationNavbar } from "../components/station_navbar"; // Ensure the path is correct
import { LogoutButton } from "../components/logout_button"; // Ensure the path is correct
import './station_dashboard.css'; // Ensure this path is correct
import { Link } from 'react-router-dom'; // Import Link from react-router-dom

export function StationDashboard() {
  // Use state for dynamic data (if applicable)
  const [scheduledTrips, setScheduledTrips] = useState(10);
  const [completedTrips, setCompletedTrips] = useState(6);
  const [delayedTrips, setDelayedTrips] = useState(1);
  const [cancelledTrips, setCancelledTrips] = useState(1);
  const [totalPassengers, setTotalPassengers] = useState(121);
  const [tripsData, setTripsData] = useState([]);

  // Fetching data or simulating loading data for trips (this can be dynamic from API)
  useEffect(() => {
    const fetchTripsData = async () => {
      // Simulate fetching trip data
      const data = [
        { route: 'Escolta-Kalawaan', departureTime: '9:00 AM', passengers: 50, status: 'On Time' },
        { route: 'Dapitan-Tondo', departureTime: '9:30 AM', passengers: 40, status: 'Delayed' },
        { route: 'Manila-Malabon', departureTime: '10:00 AM', passengers: 35, status: 'On Time' },
        // More trips data here
      ];
      setTripsData(data);
    };
    fetchTripsData();
  }, []);

  return (
    <div className="station-dashboard-container">
      {/* Include the Navbar */}
      <StationNavbar />

      {/* Main Content Section */}
      <main className="station-main-content">
        <h1 className="station-title">PUP STATION</h1>
        <header className="station-dashboard-header">
          {/* Console log to verify rendering of LogoutButton */}
          {console.log("Rendering LogoutButton")}
          <LogoutButton /> {/* Ensure LogoutButton is being used */}
        </header>

        {/* Stats Section */}
        <section className="station-stats">
          <div className="station-stat-box">
            <div className="station-stat-info">
              <h3>{scheduledTrips}</h3>
              <p>Scheduled Trips</p>
            </div>
          </div>

          <div className="station-stat-box">
            <div className="station-stat-info">
              <h3>{completedTrips}</h3>
              <p>Completed Trips</p>
            </div>
          </div>

          <div className="station-stat-box">
            <div className="station-stat-info">
              <h3>{delayedTrips}</h3>
              <p>Delayed Trips</p>
            </div>
          </div>

          <div className="station-stat-box">
            <div className="station-stat-info">
              <h3>{cancelledTrips}</h3>
              <p>Cancelled Trips</p>
            </div>
          </div>

          <div className="station-stat-box">
            <div className="station-stat-info">
              <h3>{totalPassengers}</h3>
              <p>Total Passengers</p>
            </div>
          </div>
        </section>

        {/* Trip Table Section */}
        <section className="station-trip-table">
          <table>
            <thead>
              <tr>
                <th>Scheduled Trips</th>
                <th>Departure Time</th>
                <th>Route</th>
                <th>Number of Passengers</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tripsData.map((trip, index) => (
                <tr key={index}>
                  <td>{trip.route}</td>
                  <td>{trip.departureTime}</td>
                  <td>{trip.route}</td>
                  <td>{trip.passengers}</td>
                  <td>{trip.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Announcement Section */}
        <h2 className="station-title-announcement">GENERAL ANNOUNCEMENTS</h2>
        <section className="station-announcements">
          <div className="station-announcement-card">
            <h3>Scheduled System Maintenance</h3>
            <p>
              Please be informed that the MetroLayag Passenger Management System will undergo scheduled maintenance on:
            </p>
            <p>Date: May 25, 2025</p>
            <p>Time: 3:00 PM - 5:00 PM PHT</p>
          </div>
        </section>
      </main>
    </div>
  );
}