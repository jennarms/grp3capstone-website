import { useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_disembarkingLanding.css";

export function DisembarkingLandingPage() {
  const [fromKalawaan] = useState([
    { time: "8:40 AM", availableSeats: "6 / 30" },
    { time: "9:26 AM", availableSeats: "2 / 30" },
    { time: "10:22 AM", availableSeats: "1 / 30" },
    { time: "11:22 AM", availableSeats: "0 / 30" },
  ]);

  const [fromEscolta] = useState([
    { time: "7:40 AM", availableSeats: "7 / 30" },
    { time: "8:07 AM", availableSeats: "5 / 30" },
    { time: "8:58 AM", availableSeats: "2 / 30" },
    { time: "9:59 AM", availableSeats: "0 / 30" },
  ]);

  return (
    <div className="disembark-container">
      <StationNavbar />

      <div className="disembark-main">
        <header className="disembark-header">
          <h1>Disembarking Management</h1>
          <LogoutButton />
        </header>

        <section className="disembark-table-section">
          {/* FROM KALAWAN */}
          <div className="disembark-card">
            <div className="disembark-table-wrapper">
              <table className="disembark-data-table">
                <thead>
                  <tr className="disembark-caption-row">
                    <th className="disembark-caption-th" colSpan={3}>
                      FROM KALAWAAN
                    </th>
                  </tr>
                  <tr className="disembark-cols-row">
                    <th>Time</th>
                    <th>Available Seats</th>
                    <th className="disembark-action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fromKalawaan.map((row, i) => (
                    <tr key={i}>
                      <td>{row.time}</td>
                      <td>{row.availableSeats}</td>
                      <td className="disembark-action-cell">
                        <button className="disembark-view-btn">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FROM ESCOLTA */}
          <div className="disembark-card">
            <div className="disembark-table-wrapper">
              <table className="disembark-data-table">
                <thead>
                  <tr className="disembark-caption-row">
                    <th className="disembark-caption-th" colSpan={3}>
                      FROM ESCOLTA
                    </th>
                  </tr>
                  <tr className="disembark-cols-row">
                    <th>Time</th>
                    <th>Available Seats</th>
                    <th className="disembark-action-col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fromEscolta.map((row, i) => (
                    <tr key={i}>
                      <td>{row.time}</td>
                      <td>{row.availableSeats}</td>
                      <td className="disembark-action-cell">
                        <button className="disembark-view-btn">View</button>
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