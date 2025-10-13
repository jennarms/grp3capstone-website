import { useEffect, useState } from 'react';
import { LogoutButton } from "../components/logout_button";
import { StationNavbar } from "../components/station_navbar";
import "./station_disembarking.css";

import DisembarkPassengerTable from "../modules/DisembarkPassengerTable.jsx";
import ScanButtonModule from "../modules/ScanButtonModule.jsx";

const apiUrl = import.meta.env.VITE_API_URL;

export function Disembarking() {
  const [station, setStation] = useState("loading..."); // Station name will be fetched here

  useEffect(() => {
    const fetchStationData = async () => {
      try {
        // Fetch the station name from the new endpoint
        const response = await fetch(`${apiUrl}/api/boarding/routecard/station`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
        });

        if (response.ok) {
          const data = await response.json();
          setStation(data?.station_name || "loading...");
        } else {
          setStation("Failed to fetch station");
        }
      } catch (error) {
        console.error("Error fetching station info:", error);
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

        {/* Route Card / Station Name Header */}
        <section className="dm-tripcard">
          <div className="dm-tripcard-head">
            <div className="dm-tripcard-route">{station}</div> {/* Only station name displayed here */}
          </div>
        </section>

        {/* Scan Modal */}
        <ScanButtonModule action="disembarking" />

        {/* Render the table only if destination matches the station */}
        {station !== "loading..." && (
          <DisembarkPassengerTable destination={station} />
        )}
      </main>
    </div>
  );
}
