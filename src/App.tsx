import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ChartPage from './pages/ChartPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/chart" element={<ChartPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}

export default App
