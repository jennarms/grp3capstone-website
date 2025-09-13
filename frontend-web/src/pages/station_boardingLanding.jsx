import { useState, useEffect } from "react";
import { Link } from 'react-router-dom'; // For linking the buttons to other pages (optional)
import { LogoutButton } from "../components/logout_button"; // Assuming LogoutButton is available
import './station_boardingLanding.css'; // You can customize your CSS
import { StationNavbar } from "../components/station_navbar"; // Ensure the path is correct

export function BoardingLandingPage() {
  const [kalawaanSeats, setKalawaanSeats] = useState([
    { time: "8:40 AM", availableSeats: "4 / 30" },
    { time: "9:26 AM", availableSeats: "2 / 30" },
    { time: "10:22 AM", availableSeats: "1 / 30" },
    { time: "11:22 AM", availableSeats: "0 / 30" },
  ]);

  const [escoltaSeats, setEscoltaSeats] = useState([
    { time: "7:40 AM", availableSeats: "15 / 30" },
    { time: "8:07 AM", availableSeats: "5 / 30" },
    { time: "8:58 AM", availableSeats: "2 / 30" },
    { time: "9:59 AM", availableSeats: "0 / 30" },
  ]);

  return (
    <div className="boarding-landing-container">
    

      {/* Main Content */}
      <div className="main-content">
        <header className="main-header">
          <h1>Boarding Management</h1>
          <LogoutButton />
          <StationNavbar />
        </header>

        <section className="boarding-table-section">
          {/* PUP TO KALAWAN Table */}
          <div className="boarding-table">
            <h2>PUP TO KALAWAN</h2>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Available Seats</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {kalawaanSeats.map((seat, index) => (
                  <tr key={index}>
                    <td>{seat.time}</td>
                    <td>{seat.availableSeats}</td>
                    <td><button className="view-btn">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PUP TO ESCOLTA Table */}
          <div className="boarding-table">
            <h2>PUP TO ESCOLTA</h2>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Available Seats</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {escoltaSeats.map((seat, index) => (
                  <tr key={index}>
                    <td>{seat.time}</td>
                    <td>{seat.availableSeats}</td>
                    <td><button className="view-btn">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}