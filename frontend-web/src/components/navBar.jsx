import React from 'react';
import { Link } from 'react-router-dom';
import './navBar.css'; // Make sure this path is correct

export function Navbar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-profile">
        <img
          src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png"
          alt="Admin Icon"
          className="sidebar-icon"
        />
      </div>
      <h2 className="sidebar-title">Main Admin</h2>
      <nav className="sidebar-nav">
        <Link to="/announcement" className="sidebar-link">
          General Announcement
        </Link>
        <Link to="/broadcast" className="sidebar-link">
          Broadcast Channel
        </Link>
        <Link to="/operations" className="sidebar-link">
          Operations Management
        </Link>
        <Link to="/passengers" className="sidebar-link">
          Passenger Management
        </Link>
        <Link to="/feedback" className="sidebar-link">
          Feedback
        </Link>
        <Link to="/faqs" className="sidebar-link">
          FAQs Management
        </Link>
        <Link to="/customization" className="sidebar-link">
          UI Customization
        </Link>
        <Link to="/reports" className="sidebar-link">
          Report Generation
        </Link>
      </nav>
    </aside>
  );
}