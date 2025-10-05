import React from 'react';
import { Link } from 'react-router-dom';
import './station_navbar.css';

import BroadcastBadge from '../broadcast/BroadcastBadge';

export function StationNavbar() {
  const adminName = localStorage.getItem("admin_name") || "Station Admin";

  return (
    <aside className="station-admin-sidebar">
      <div className="station-admin-sidebar-profile">
        <img
          src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png"
          alt="Station Admin Icon"
          className="station-admin-sidebar-icon"
        />
      </div>

      <h2 className="station-admin-sidebar-title">{adminName}</h2>

      <nav className="station-admin-sidebar-nav">
        <Link to="/dashboard" className="station-admin-sidebar-link">Dashboard</Link>
        <Link to="/boarding" className="station-admin-sidebar-link">Boarding Management</Link>
        <Link to="/disembarking" className="station-admin-sidebar-link">Disembarking Management</Link>
        <Link to="/stationsos" className="station-admin-sidebar-link">SOS</Link>

        {/* Broadcast link: keep label centered; badge floats top-right */}
        <Link to="/broadcast" className="station-admin-sidebar-link broadcast-link">
          <span className="broadcast-link-label">Broadcast Channel</span>
          <BroadcastBadge variant="circle" className="broadcast-badge-circle" />
        </Link>
      </nav>
    </aside>
  );
}
