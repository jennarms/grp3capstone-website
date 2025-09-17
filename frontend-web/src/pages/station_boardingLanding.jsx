import { useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_boardingLanding.css";

export function BoardingLandingPage() {
  const [kalawaanSeats] = useState([
    { time: "8:40 AM", availableSeats: "6 / 30" },
    { time: "9:26 AM", availableSeats: "2 / 30" },
    { time: "10:22 AM", availableSeats: "1 / 30" },
    { time: "11:22 AM", availableSeats: "0 / 30" },
  ]);

  const [escoltaSeats] = useState([
    { time: "7:40 AM", availableSeats: "7 / 30" },
    { time: "8:07 AM", availableSeats: "5 / 30" },
    { time: "8:58 AM", availableSeats: "2 / 30" },
    { time: "9:59 AM", availableSeats: "0 / 30" },
  ]);

  return (
    <div className="boarding-landing-container">
      <StationNavbar />

      <div className="main-content">
        <header className="main-header">
          <h1>Boarding Management</h1>
          <LogoutButton />
        </header>

        <section className="table-section">
          {/* TABLE 1 */}
          <div className="card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr className="caption-row">
                    <th className="caption-th" colSpan={3}>PUP TO KALAWAAN</th>
                  </tr>
                  <tr className="cols-row">
                    <th>Time</th>
                    <th>Available Seats</th>
                    <th className="action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {kalawaanSeats.map((seat, i) => (
                    <tr key={i}>
                      <td>{seat.time}</td>
                      <td>{seat.availableSeats}</td>
                      <td className="action-cell">
                        <button className="view-btn">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 2 */}
          <div className="card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr className="caption-row">
                    <th className="caption-th" colSpan={3}>PUP TO ESCOLTA</th>
                  </tr>
                  <tr className="cols-row">
                    <th>Time</th>
                    <th>Available Seats</th>
                    <th className="action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {escoltaSeats.map((seat, i) => (
                    <tr key={i}>
                      <td>{seat.time}</td>
                      <td>{seat.availableSeats}</td>
                      <td className="action-cell">
                        <button className="view-btn">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </section>
      </div>
    </div>
  );
}