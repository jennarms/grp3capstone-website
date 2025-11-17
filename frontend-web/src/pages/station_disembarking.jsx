// ===============================
// station_disembark.jsx
// ===============================
import { useEffect, useState } from "react";
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_disembarking.css";

import DisembarkPassengerTable from "../modules/DisembarkPassengerTable.jsx";
import ScanButtonModule from "../modules/ScanButtonModule.jsx";

const apiUrl = import.meta.env.VITE_API_URL;

export function Disembarking() {
  const [station, setStation] = useState("loading...");

  // PAGE RENDER DEBUG
  console.log("📌 PAGE RENDER — station =", station);

  useEffect(() => {
    const fetchStationData = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/boarding/routecard/station`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        if (res.ok) {
          const data = await res.json();

          console.log("📥 FETCHED STATION =", data.station_name);

          setStation(data.station_name || "loading...");
        } else {
          setStation("Failed to fetch station");
        }
      } catch (err) {
        console.error("❌ ERROR FETCHING STATION:", err);
        setStation("Failed to fetch station");
      }
    };

    fetchStationData();
  }, []);

return (
  <div className="dm-shell">
    <StationNavbar />
    <main className="dm-main">
      <h1 className="dm-title">Disembarking Management</h1>
      <LogoutButton />

      <section className="dm-tripcard">
        <div className="dm-tripcard-head">
          <div className="dm-tripcard-route">{station}</div>
        </div>
      </section>

      <ScanButtonModule action="disembarking" />

      {station &&
        station !== "loading..." &&
        station !== "Failed to fetch station" ? (
          <DisembarkPassengerTable destination={station} />
        ) : (
          <p className="loading-message">Loading station...</p>
        )}
    </main>
  </div>
);
}
