import { Route, HashRouter as Router, Routes } from 'react-router-dom'
import './App.css'
import { Broadcast } from './pages/broadcastChannel'
import { Edit } from './pages/editAccount'
import { FAQs } from './pages/faqsManagement'
import { Feedback } from './pages/feedback'
import { Announcement } from './pages/generalAnnouncement'
import { Login } from './pages/login'
import { Passenger } from './pages/passengerManagement'
import { FeedbackSettings } from './pages/feedbackSettings'
import { AccountSettings } from './pages/accountSettings'
import { Report } from './pages/reportGeneration'
import { UI } from './pages/uiCustomization'
import VehicleTab from "./pages/operations_vehicleTab";
import { StationsTab } from './pages/operations_stationsTab'
import {RoutesTab} from './pages/operations_routesTab'
import { SchedulesTab } from './pages/operations_schedulesTab'
import FaresTab from './pages/operations_faresTab'
import { StationDashboard } from './pages/station_dashboard'
import { BoardingLandingPage } from './pages/station_boardingLanding'
import { Boarding } from './pages/station_boarding'
import { DisembarkingLandingPage } from './pages/station_disembarkingLanding'



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
        <Route path='/feedbackSettings' element={<FeedbackSettings/>}/>
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
        <Route path="/disembarking" element={<DisembarkingLandingPage />} />




      </Routes>
    </Router>
  )
}

export default App
