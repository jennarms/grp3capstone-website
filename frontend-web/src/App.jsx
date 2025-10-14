// App.jsx
import { HashRouter as Router, Routes, Route, Outlet, useLocation } from "react-router-dom";
import React, { useEffect } from "react";
import "./App.css";

// ✅ ADD ALL MISSING IMPORTS
// Pages
import Login from "./pages/Login";
import FAQs from "./pages/FAQs";
import Edit from "./pages/Edit";
import Announcement from "./pages/Announcement";
import Broadcast from "./pages/Broadcast";
import Passenger from "./pages/Passenger";
import Feedback from "./pages/Feedback";
import FeedbackSettings from "./pages/FeedbackSettings";
import AccountSettings from "./pages/AccountSettings";
import Report from "./pages/Report";
import UI from "./pages/UICustomization";
import VehicleTab from "./pages/operations/VehicleTab";
import StationsTab from "./pages/operations/StationsTab";
import RoutesTab from "./pages/operations/RoutesTab";
import SchedulesTab from "./pages/operations/SchedulesTab";
import FaresTab from "./pages/operations/FaresTab";
import StationDashboard from "./pages/StationDashboard";
import BoardingLandingPage from "./pages/BoardingLandingPage";
import Boarding from "./pages/Boarding";
import DisembarkingLandingPage from "./pages/DisembarkingLandingPage";
import Disembarking from "./pages/Disembarking";
import StationSOS from "./pages/StationSOS";
import SOSTestPage from "./pages/SOSTestPage";

// Providers and Components
import { BroadcastProvider } from "./context/BroadcastContext";
import { SOSProvider } from "./context/SOSContext";
import GlobalBroadcastBanner from "./components/GlobalBroadcastBanner";
import GlobalSOSBanner from "./components/GlobalSOSBanner";

function ProtectedShell() {
  const location = useLocation();
  const userId =
    localStorage.getItem("admin_id") ||
    localStorage.getItem("admin_name") ||
    "";

  const onLogin = location.pathname === "/" || location.pathname === "/login";
  const isAuthed = Boolean(userId);

  if (onLogin || !isAuthed) return <Outlet />;

  return (
    <BroadcastProvider userId={userId}>
      <SOSProvider enabled={true}>
        <GlobalBroadcastBanner />
        <GlobalSOSBanner />
        <Outlet />
      </SOSProvider>
    </BroadcastProvider>
  );
}

function App() {
  // ✅ one-time backend health check when the app mounts
  useEffect(() => {
    const API = import.meta.env.VITE_API_URL;
    console.log("VITE_API_URL =", API);
    if (!API) {
      console.error("VITE_API_URL is undefined. Set it in Render → Static Site → Environment.");
      return;
    }
    fetch(`${API}/api/healthz`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => console.log("healthz:", data))
      .catch((err) => console.error("healthz error:", err));
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<ProtectedShell />}>
          {/* ✨ keep ALL your existing routes exactly as they are */}
          <Route path="/faqs" element={<FAQs />} />
          <Route path="/edit" element={<Edit />} />
          <Route path="/announcement" element={<Announcement />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/passenger" element={<Passenger />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/feedback/settings" element={<FeedbackSettings />} />
          <Route path="/accountSettings" element={<AccountSettings />} />
          <Route path="/reports" element={<Report />} />
          <Route path="/UICustomization" element={<UI />} />
          <Route path="/operations/vehicle" element={<VehicleTab />} />
          <Route path="/operations/stations" element={<StationsTab />} />
          <Route path="/operations/routes" element={<RoutesTab />} />
          <Route path="/operations/schedules" element={<SchedulesTab />} />
          <Route path="/operations/fares" element={<FaresTab />} />
          <Route path="/dashboard" element={<StationDashboard />} />
          <Route path="/boarding" element={<BoardingLandingPage />} />
          <Route path="/station-boarding/:scheduleId" element={<Boarding />} />
          <Route path="/disembarkingL" element={<DisembarkingLandingPage />} />
          <Route path="/disembarking" element={<Disembarking />} />
          <Route path="/stationsos" element={<StationSOS />} />
          <Route path="/sostest" element={<SOSTestPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;