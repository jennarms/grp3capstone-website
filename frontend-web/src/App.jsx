import './App.css'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { Login } from './pages/login'
import { FAQs } from './pages/faqsManagement'
import { Edit } from './pages/editAccount'
import { Announcement } from './pages/generalAnnouncement'
import { Broadcast } from './pages/broadcastChannel'
import { Passenger } from './pages/passengerManagement'
import { Feedback } from './pages/feedback'




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
      </Routes>
    </Router>
  )
}

export default App
