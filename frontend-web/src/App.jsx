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
      </Routes>
    </Router>
  )
}

export default App
