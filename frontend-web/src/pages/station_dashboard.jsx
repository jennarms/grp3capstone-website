import React, { useMemo, useState } from "react";
import "./station_dashboard.css";

import { StationNavbar } from "../components/station_navbar";
import { LogoutButton } from "../components/logout_button";
// ❌ remove: import { useSOSStore } from "../sos/SOSContext";

/* Lightweight inline SVG icons (no external deps) */
const baseIcon = (pathProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ width: 24, height: 24 }}
  >
    {pathProps}
  </svg>
);
const Bell          = (p) => baseIcon(<path d="M10 21h4M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" {...p} />);
const Clock         = (p) => baseIcon(<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>);
const CheckCircle2  = (p) => baseIcon(<><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></>);
const AlertTriangle = (p) => baseIcon(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>);
const XCircle       = (p) => baseIcon(<><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></>);
const Users         = (p) => baseIcon(<><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>);

/** Demo data (replace with your real data) */
const scheduledTrips = 10;
const completedTrips = 6;
const delayedTrips   = 1;
const cancelledTrips = 1;
const totalPassengers= 121;

const tripsDataInitial = [
  { trip: "Escolta-Kalawaan", departureTime: "9:00 AM",  route: "Escolta-Kalawaan",  passengers: 50, status: "On Time" },
  { trip: "Dapitan-Tondo",    departureTime: "9:30 AM",  route: "Dapitan-Tondo",     passengers: 40, status: "Delayed" },
  { trip: "Manila-Malabon",   departureTime: "10:00 AM", route: "Manila-Malabon",    passengers: 35, status: "On Time" },
  { trip: "Kalawaan-España",  departureTime: "10:20 AM", route: "Kalawaan-España",   passengers: 28, status: "On Time" },
  { trip: "Navotas-Pasig",    departureTime: "10:50 AM", route: "Navotas-Pasig",     passengers: 31, status: "On Time" },
];

const announcements = [
  { title: "Scheduled System Maintenance", body: [
    "Please be informed that the MetroLayag Passenger Management System will undergo scheduled maintenance on:",
    "Date: May 25, 2025",
    "Time: 3:00 PM - 5:00 PM PHT",
  ]},
  { title: "Weather Advisory", body: [
    "Expect intermittent rain showers in the afternoon.",
    "Some trips may be delayed by 10–15 minutes for safety checks.",
  ]},
  { title: "New Boarding Flow", body: [
    "Starting next week, boarding gates will open 20 minutes before departure.",
    "Please have your QR code ready at the gate.",
  ]},
  { title: "Lost & Found Reminder", body: [
    "Items are kept for 30 days at the PUP Station office.",
    "Bring a valid ID to claim.",
  ]},
  { title: "System Update", body: [
    "We’ve improved seat availability syncing across stations.",
    "Report any glitches via the Help menu.",
  ]},
];

/* Small UI bits */
function KPI({ icon: Icon, label, value }) {
  return (
    <div className="station-stat-box">
      <div className="station-stat-info" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ background:"#f8fafc", borderRadius:12, padding:10, lineHeight:0 }}>
          <Icon />
        </div>
        <div>
          <h3>{value}</h3>
          <p>{label}</p>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  let cls = "status-pill";
  if (status === "On Time") cls += " is-ontime";
  else if (status === "Delayed") cls += " is-delayed";
  else if (status === "Cancelled") cls += " is-cancelled";
  return <span className={cls}>{status}</span>;
}

function StationDashboard() {
  // ❌ remove: const { openCount = 0 } = useSOSStore();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [trips] = useState(tripsDataInitial);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      const matchesQuery = query
        ? [t.trip, t.route, t.departureTime].some((f) =>
            f.toLowerCase().includes(query.toLowerCase()))
        : true;
      const matchesStatus = statusFilter === "All" ? true : t.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, trips, statusFilter]);

  return (
    <div className="station-dashboard-container">
      <StationNavbar />

      <main className="station-main-content">
        {/* Header with title + Logout (counter removed) */}
        <div className="station-header-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <h1 className="station-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            PUP STATION
            {/* Counter removed */}
          </h1>
          <LogoutButton />
        </div>

        {/* ====== Stats ====== */}
        <section className="station-stats">
          <KPI icon={Clock}        label="Scheduled Trips" value={scheduledTrips} />
          <KPI icon={CheckCircle2} label="Completed Trips" value={completedTrips} />
          <KPI icon={AlertTriangle}label="Delayed Trips"   value={delayedTrips} />
          <KPI icon={XCircle}      label="Cancelled Trips" value={cancelledTrips} />
          <KPI icon={Users}        label="Total Passengers" value={totalPassengers} />
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
                {filtered.map((t, i) => (
                  <tr key={i}>
                    <td>{t.trip}</td>
                    <td>{t.departureTime}</td>
                    <td>{t.route}</td>
                    <td>{t.passengers}</td>
                    <td><StatusPill status={t.status} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign:"center", padding:"24px", color:"#64748b" }}>
                      No trips match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ====== Announcements ====== */}
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

export default StationDashboard;
export { StationDashboard };
