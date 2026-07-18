import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ChartPage from './pages/ChartPage'
import SettingsPage from './pages/SettingsPage'
import DashboardPage from './pages/DashboardPage'
import SessionsPage from './pages/SessionsPage'
import ImportPage from './pages/ImportPage'
import AppShell from './components/AppShell'
import { SessionProvider } from './context/SessionContext'
import { Activity, ShieldAlert } from 'lucide-react'

function App() {
  const [isHealthy, setIsHealthy] = useState<boolean>(false)
  const [showRetryMsg, setShowRetryMsg] = useState<boolean>(false)

  useEffect(() => {
    let active = true
    let retryTimer: any
    let msgTimer: any

    // Show warning message after 1.5 seconds if backend has not responded yet
    msgTimer = setTimeout(() => {
      if (active) setShowRetryMsg(true)
    }, 1500)

    const checkHealth = () => {
      fetch('http://localhost:8000/api/health')
        .then(res => {
          if (res.ok) {
            if (active) {
              setIsHealthy(true)
              console.log('[HealthCheck] Backend health check passed!')
            }
          } else {
            throw new Error('Not healthy status')
          }
        })
        .catch(err => {
          if (active) {
            console.warn('[HealthCheck] Health check failed, retrying in 1s...', err)
            retryTimer = setTimeout(checkHealth, 1000)
          }
        })
    }

    checkHealth()

    return () => {
      active = false
      clearTimeout(retryTimer)
      clearTimeout(msgTimer)
    }
  }, [])

  if (!isHealthy) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 text-white font-sans flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
            <Activity className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
          
          {/* Dashboard Overview */}
          <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            ChartFlow Workspace
          </h2>
          
          <p className="text-slate-400 text-sm mb-8">
            Initializing connection with local database and backend server...
          </p>

          {showRetryMsg && (
            <div className="flex items-center gap-2.5 text-amber-450 bg-amber-500/5 border border-amber-500/15 p-3.5 rounded-xl text-xs font-medium mb-6 w-full justify-center">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400 animate-bounce" />
              <span>Backend taking longer to respond. Please ensure uvicorn is running.</span>
            </div>
          )}

          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <SessionProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/chart" element={<ChartPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </AppShell>
    </SessionProvider>
  )
}

export default App
