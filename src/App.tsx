import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ChartPage from './pages/ChartPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/chart" element={<ChartPage />} />
    </Routes>
  )
}

export default App
