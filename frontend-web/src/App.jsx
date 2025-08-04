import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    fetch('http://127.0.0.1:5000/api/hello')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(err => {
      console.error("Fetch error:", err); // ✅ now err is used
      setMessage("Failed to connect to backend");
    });
  }, [])

  return (
    <div className="p-8 text-center">
      <h1 className="text-3xl font-bold text-blue-600">{message}</h1>
    </div>
  )
}

export default App
