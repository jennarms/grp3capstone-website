import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './navBar.css'; // Make sure this path is correct

export function Navbar() {
  // ✅ Get the username from localStorage
  const [adminName, setAdminName] = useState("Main Admin");

  useEffect(() => {
    const storedName = localStorage.getItem("admin_name");
    if (storedName) setAdminName(storedName);
  }, []);

  return (
    <aside className="navbar-sidebar">
      <div className="navbar-sidebar-profile">
        <img 
          src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png" 
          alt="Admin Icon" 
          className="navbar-sidebar-icon" 
        />
      </div>

      {/* Display the logged-in username */}
      <h2 className="navbar-sidebar-title">{adminName}</h2>

      <nav className="navbar-sidebar-nav">
        <Link to="/announcement" className="navbar-sidebar-link">
          General Announcement
        </Link>
        <Link to="/broadcast" className="navbar-sidebar-link">
          Broadcast Channel
        </Link>
        <Link to="/operations/vehicle" className="navbar-sidebar-link">
          Operations Management
        </Link>
        <Link to="/passenger" className="navbar-sidebar-link">
          Passenger Management
        </Link>
        <Link to="/feedback" className="navbar-sidebar-link">
          Feedback
        </Link>
        <Link to="/faqs" className="navbar-sidebar-link">
          FAQs Management
        </Link>
        <Link to="/UICustomization" className="navbar-sidebar-link">
          UI Customization
        </Link>
        <Link to="/reports" className="navbar-sidebar-link">
          Report Generation
        </Link>
      </nav>
    </aside>
  );
}
