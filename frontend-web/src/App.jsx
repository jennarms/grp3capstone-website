// App.tsx
import { HashRouter as Router, Routes, Route, Outlet, useLocation } from "react-router-dom";
import React from "react";
import "./App.css";

import { AccountSettings } from "./pages/accountSettings";
import { Broadcast } from "./pages/broadcastChannel";
import { Edit } from "./pages/editAccount";
import { FAQs } from "./pages/faqsManagement";
import { Feedback } from "./pages/feedback";
import { FeedbackSettings } from "./pages/feedbackSettings";
import { Announcement } from "./pages/generalAnnouncement";
import { Login } from "./pages/login";
import FaresTab from "./pages/operations_faresTab";
import { RoutesTab } from "./pages/operations_routesTab";
import { SchedulesTab } from "./pages/operations_schedulesTab";
import { StationsTab } from "./pages/operations_stationsTab";
import VehicleTab from "./pages/operations_vehicleTab";
import { Passenger } from "./pages/passengerManagement";
import { Report } from "./pages/reportGeneration";
import { Boarding } from "./pages/station_boarding";
import { BoardingLandingPage } from "./pages/station_boardingLanding";
import { StationDashboard } from "./pages/station_dashboard";
import { Disembarking } from "./pages/station_disembarking";
import { DisembarkingLandingPage } from "./pages/station_disembarkingLanding";
import { StationSOS } from "./pages/station_sos";
import { UI } from "./pages/uiCustomization";
import { SOSTestPage } from "./pages/SOSTestPage";

/* SOS */
import { SOSProvider } from "./sos/SOSContext";
import GlobalSOSBanner from "./sos/GlobalSOSBanner";

/* Broadcast */
import { BroadcastProvider } from "./broadcast/BroadcastProvider";
import GlobalBroadcastBanner from "./broadcast/GlobalBroadcastBanner";

/** Only render providers + global banners on non-login routes */
function ProtectedShell() {
  const location = useLocation();
  // If you have a real auth signal, prefer that (e.g., token). This is your current pattern:
  const userId =
    localStorage.getItem("admin_id") ||
    localStorage.getItem("admin_name") ||
    ""; // <-- no fallback to avoid "station-admin" during login

  // Hide banners/providers on login path or when not authenticated
  const onLogin = location.pathname === "/" || location.pathname === "/login";
  const isAuthed = Boolean(userId);

  if (onLogin || !isAuthed) {
    // Render child routes without providers/banners (e.g., /)
    return <Outlet />;
  }

  // Render the rest of the app with global providers and banners
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
  return (
    <Router>
      <Routes>
        {/* Public route(s) */}
        <Route path="/" element={<Login />} />

        {/* Everything else goes under the ProtectedShell */}
        <Route element={<ProtectedShell />}>
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
