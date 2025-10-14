// App.jsx
import React, { useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import "./App.css";

/* Pages */
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

/* Providers & banners */
import { SOSProvider } from "./sos/SOSContext";
import GlobalSOSBanner from "./sos/GlobalSOSBanner";
import { BroadcastProvider } from "./broadcast/BroadcastProvider";
import GlobalBroadcastBanner from "./broadcast/GlobalBroadcastBanner";

/* ---------- auth util (no hooks) ---------- */
function getAuthUserId() {
  return (
    localStorage.getItem("admin_id") ||
    localStorage.getItem("admin_name") ||
    ""
  );
}

/* Public routes only when NOT authed */
function PublicOnly({ children }) {
  const userId = getAuthUserId();
  if (userId) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/* Protected routes with providers/banners */
function RequireAuth() {
  const userId = getAuthUserId();
  if (!userId) return <Navigate to="/login" replace />;

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

/* Catch-all redirect that respects auth */
function CatchAllRedirect() {
  const userId = getAuthUserId();
  return userId ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

function App() {
  // Health check removed temporarily - will be restored when backend is deployed
  /*
  useEffect(() => {
    const API = import.meta.env.VITE_API_URL;
    if (!API) {
      console.error(
        "VITE_API_URL is undefined. Set it in your hosting environment."
      );
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
  */

  return (
    <Router>
      <Routes>
        {/* Public (visible only when NOT authed) */}
        <Route
          index
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />

        {/* Protected (must be authed; providers included) */}
        <Route element={<RequireAuth />}>
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

        {/* Catch-all */}
        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;