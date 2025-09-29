import { Route, HashRouter as Router, Routes } from 'react-router-dom'
import './App.css'
import { AccountSettings } from './pages/accountSettings'
import { Broadcast } from './pages/broadcastChannel'
import { Edit } from './pages/editAccount'
import { FAQs } from './pages/faqsManagement'
import { Feedback } from './pages/feedback'
import { FeedbackSettings } from './pages/feedbackSettings'
import { Announcement } from './pages/generalAnnouncement'
import { Login } from './pages/login'
import FaresTab from './pages/operations_faresTab'
import { RoutesTab } from './pages/operations_routesTab'
import { SchedulesTab } from './pages/operations_schedulesTab'
import { StationsTab } from './pages/operations_stationsTab'
import VehicleTab from "./pages/operations_vehicleTab"
import { Passenger } from './pages/passengerManagement'
import { Report } from './pages/reportGeneration'
import { Boarding } from './pages/station_boarding'
import { BoardingLandingPage } from './pages/station_boardingLanding'
import { StationDashboard } from './pages/station_dashboard'
import { Disembarking } from './pages/station_disembarking'
import { DisembarkingLandingPage } from './pages/station_disembarkingLanding'
import { StationSOS } from './pages/station_sos'
import { UI } from './pages/uiCustomization'



function App() {
  return(
    <Router>
      <Routes>
        <Route path="/" element={<Login/>}/>
        <Route path='/faqs' element={<FAQs/>}/>
        <Route path='/edit' element={<Edit/>}/>
        <Route path='/announcement' element={<Announcement/>}/>
        <Route path='/broadcast' element={<Broadcast/>}/>
        <Route path='/passenger' element={<Passenger/>}/>
        <Route path='/feedback' element={<Feedback/>}/>
        <Route path='/feedback/settings' element={<FeedbackSettings/>}/>
        <Route path='/accountSettings' element={<AccountSettings/>}/>
        <Route path='/reports' element={<Report/>}/>
        <Route path='/UICustomization' element ={<UI/>}/>
        <Route path="/operations/vehicle" element={<VehicleTab />} />
        <Route path="/operations/stations" element={<StationsTab />} />
        <Route path="/operations/routes" element={<RoutesTab />} />
        <Route path="/operations/schedules" element={<SchedulesTab />} />
        <Route path="/operations/fares" element={<FaresTab />} /> 
        <Route path="/dashboard" element={<StationDashboard />} />
        <Route path="/boarding" element={<BoardingLandingPage />} />
        <Route path="/boarding/passengerlist" element={<Boarding />} />
        <Route path="/disembarkingL" element={<DisembarkingLandingPage />} />
        <Route path="/disembarking" element={<Disembarking />} />
        <Route path="/stationsos" element={<StationSOS />} />




      </Routes>
    </Router>
  )
}

export default App
