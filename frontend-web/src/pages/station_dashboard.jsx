import { StationNavbar } from "../components/station_navbar";
import { LogoutButton } from "../components/logout_button";
import "./station_dashboard.css";

export function StationDashboard() {
  // Simple constants (no state needed since these don’t change on this view)
  const scheduledTrips = 10;
  const completedTrips = 6;
  const delayedTrips = 1;
  const cancelledTrips = 1;
  const totalPassengers = 121;

  const tripsData = [
    { route: "Escolta-Kalawaan", departureTime: "9:00 AM", passengers: 50, status: "On Time" },
    { route: "Dapitan-Tondo", departureTime: "9:30 AM", passengers: 40, status: "Delayed" },
    { route: "Manila-Malabon", departureTime: "10:00 AM", passengers: 35, status: "On Time" },
    { route: "Kalawaan-España", departureTime: "10:20 AM", passengers: 28, status: "On Time" },
    { route: "Navotas-Pasig", departureTime: "10:50 AM", passengers: 31, status: "On Time" },
  ];

  const announcements = [
    {
      title: "Scheduled System Maintenance",
      body: [
        "Please be informed that the MetroLayag Passenger Management System will undergo scheduled maintenance on:",
        "Date: May 25, 2025",
        "Time: 3:00 PM - 5:00 PM PHT",
      ],
    },
    {
      title: "Weather Advisory",
      body: [
        "Expect intermittent rain showers in the afternoon.",
        "Some trips may be delayed by 10–15 minutes for safety checks.",
      ],
    },
    {
      title: "New Boarding Flow",
      body: [
        "Starting next week, boarding gates will open 20 minutes before departure.",
        "Please have your QR code ready at the gate.",
      ],
    },
    {
      title: "Lost & Found Reminder",
      body: [
        "Items are kept for 30 days at the PUP Station office.",
        "Bring a valid ID to claim.",
      ],
    },
    {
      title: "System Update",
      body: [
        "We’ve improved seat availability syncing across stations.",
        "Report any glitches via the Help menu.",
      ],
    },
  ];

  return (
    <div className="station-dashboard-container">
      <StationNavbar />

      <main className="station-main-content">
        <h1 className="station-title">PUP STATION</h1>

        <header className="station-dashboard-header">
          <LogoutButton />
        </header>

        {/* ====== Stats ====== */}
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

        {/* ====== Trips Table ====== */}
        <section className="station-trip-table">
          <div className="station-trip-table__scroll">
            <table>
              <thead>
                <tr>
                  <th>Trip</th>
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
                    <td>
                      <span className={`status-pill ${trip.status === "Delayed" ? "is-delayed" : "is-ontime"}`}>
                        {trip.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ====== Announcements (scrollable) ====== */}
        <h2 className="station-title-announcement">GENERAL ANNOUNCEMENTS</h2>
        <section className="station-announcements station-announcements--scroll">
          {announcements.map((a, i) => (
            <div className="station-announcement-card" key={i}>
              <h3>{a.title}</h3>
              {a.body.map((line, j) => (
                <p key={j}>{line}</p>
              ))}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
