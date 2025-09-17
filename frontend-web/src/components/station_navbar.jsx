import { Link } from 'react-router-dom';
import './station_navbar.css'; // Ensure this path is correct

export function StationNavbar() {
  return (
    <aside className="station-admin-sidebar">
      <div className="station-admin-sidebar-profile">
        <img
          src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png"
          alt="Station Admin Icon"
          className="station-admin-sidebar-icon"
        />
      </div>
      <h2 className="station-admin-sidebar-title">PUP Admin</h2>
      <nav className="station-admin-sidebar-nav">
        <Link to="/dashboard" className="station-admin-sidebar-link">
          Dashboard
        </Link>
        <Link to="/boarding" className="station-admin-sidebar-link">
          Boarding Management
        </Link>
        <Link to="/disembarking" className="station-admin-sidebar-link">
          Disembarking Management
        </Link>
        <Link to="/sos" className="station-admin-sidebar-link">
          SOS
        </Link>
        <Link to="/broadcast" className="station-admin-sidebar-link">
          Broadcast Channel
        </Link>
      </nav>
    </aside>
  );
}