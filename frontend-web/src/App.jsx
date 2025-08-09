import './App.css'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { Login } from './pages/login'
import { FAQs } from './pages/faqsManagement'
import { Edit } from './pages/editAccount'
import { Announcement } from './pages/generalAnnouncement'
import { Broadcast } from './pages/broadcastChannel'



function App() {
  return(
    <Router>
      <Routes>
        <Route path="/" element={<Login/>}/>
        <Route path='/faqs' element={<FAQs/>}/>
        <Route path='/edit' element={<Edit/>}/>
        <Route path='/announcement' element={<Announcement/>}/>
        <Route path='/broadcast' element={<Broadcast/>}/>
      </Routes>
    </Router>
  )
}

export default App
