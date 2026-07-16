import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ChartPage from './pages/ChartPage'
import SettingsPage from './pages/SettingsPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/chart" element={<ChartPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/landing" element={<LandingPage />} />
    </Routes>
  )
}

export default App
