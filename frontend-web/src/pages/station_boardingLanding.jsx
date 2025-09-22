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
    <div className="blp-container">
      <StationNavbar />

      <div className="blp-main">
        <header className="blp-header">
          <h1>Boarding Management</h1>
          <LogoutButton />
        </header>

        <section className="blp-table-section">
          {/* TABLE 1 */}
          <div className="blp-card">
            <div className="blp-table-wrapper">
              <table className="blp-data-table">
                <thead>
                  <tr className="blp-caption-row">
                    <th className="blp-caption-th" colSpan={3}>
                      PUP TO KALAWAAN
                    </th>
                  </tr>
                  <tr className="blp-cols-row">
                    <th>Time</th>
                    <th>Available Seats</th>
                    <th className="blp-action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {kalawaanSeats.map((seat, i) => (
                    <tr key={`k-${i}`}>
                      <td>{seat.time}</td>
                      <td>{seat.availableSeats}</td>
                      <td className="blp-action-cell">
                        <button className="blp-view-btn">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE 2 */}
          <div className="blp-card">
            <div className="blp-table-wrapper">
              <table className="blp-data-table">
                <thead>
                  <tr className="blp-caption-row">
                    <th className="blp-caption-th" colSpan={3}>
                      PUP TO ESCOLTA
                    </th>
                  </tr>
                  <tr className="blp-cols-row">
                    <th>Time</th>
                    <th>Available Seats</th>
                    <th className="blp-action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {escoltaSeats.map((seat, i) => (
                    <tr key={`e-${i}`}>
                      <td>{seat.time}</td>
                      <td>{seat.availableSeats}</td>
                      <td className="blp-action-cell">
                        <button className="blp-view-btn">View</button>
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
