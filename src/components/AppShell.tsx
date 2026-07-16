import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { Compass, Calendar, Database, BookOpen, Terminal, Settings, CandlestickChart } from 'lucide-react'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const { session } = useSession()

  // Skip the shell layout for the landing page
  if (location.pathname === '/landing') {
    return <>{children}</>
  }

  const navItems = [
    {
      name: 'Dashboard',
      icon: Compass,
      path: '/',
      active: location.pathname === '/'
    },
    {
      name: 'Sessions',
      icon: Calendar,
      path: '/', // dashboard holds sessions manager
      active: false // sessions are managed from dashboard
    },
    {
      name: 'Import',
      icon: Database,
      path: '/import',
      active: location.pathname === '/import'
    },
    {
      name: 'Journal',
      icon: BookOpen,
      path: '/journal',
      active: location.pathname === '/journal'
    },
    {
      name: 'Logs',
      icon: Terminal,
      path: '/logs',
      active: location.pathname === '/logs'
    },
    {
      name: 'Settings',
      icon: Settings,
      path: '/settings?tab=symbol',
      active: location.pathname === '/settings' && new URLSearchParams(location.search).get('tab') === 'symbol'
    }
  ]

  // If inside a session, we append session query parameter to links so they keep it if clicked
  const getPathWithSession = (path: string) => {
    if (!session) return path
    // Parse target path and append session id
    const url = new URL(path, window.location.origin)
    url.searchParams.set('session', session.id)
    return url.pathname + url.search
  }

  return (
    <div className="min-h-screen bg-tv-bg-primary text-tv-text-primary font-tv flex flex-col overflow-hidden">
      {/* Persistent Top Bar */}
      <header className="h-16 border-b border-tv-border bg-tv-bg-secondary/65 backdrop-blur-xl flex items-center justify-between px-6 z-30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CandlestickChart className="w-7 h-7 text-tv-brand" />
          <span className="text-xl font-bold text-tv-text-primary tracking-tight">
            ChartFlow
          </span>
        </div>

        {session ? (
          <div className="flex items-center gap-3 bg-tv-brand/10 border border-tv-brand/20 px-4 py-1.5 rounded-tv-xl text-sm font-semibold text-tv-brand transition-all shadow-lg shadow-tv-brand/5">
            <span className="w-2 h-2 rounded-full bg-tv-brand animate-pulse" />
            <span>Active Session: <strong className="text-tv-text-primary">{session.name}</strong></span>
            <span className="text-tv-text-muted">|</span>
            <span className="font-mono text-xs bg-tv-bg-primary px-2 py-0.5 rounded-tv-sm border border-tv-border text-tv-text-primary">
              {session.symbol}
            </span>
          </div>
        ) : (
          <div className="text-xs text-tv-text-muted font-semibold bg-tv-bg-secondary border border-tv-border px-3.5 py-1.5 rounded-tv-xl uppercase tracking-wider">
            No Active Session
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Persistent Left Nav Rail */}
        <aside className="w-20 border-r border-tv-border bg-tv-bg-secondary/40 backdrop-blur-xl flex flex-col items-center py-6 gap-6 z-20 flex-shrink-0">
          <nav className="flex-1 w-full flex flex-col gap-5 items-center">
            {navItems.map((item, idx) => {
              const Icon = item.icon
              const finalPath = getPathWithSession(item.path)
              return (
                <Link
                  key={idx}
                  to={finalPath}
                  className={`group relative w-12 h-12 rounded-tv-lg flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-105 cursor-pointer ${
                    item.active
                      ? 'bg-tv-brand/10 border border-tv-brand/35 text-tv-brand'
                      : 'text-tv-text-muted hover:text-tv-text-primary border border-transparent hover:bg-tv-bg-tertiary/50'
                  }`}
                  title={item.name}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-bold tracking-wide uppercase scale-90 opacity-60">
                    {item.name}
                  </span>
                  {/* Glowing hover line on the left */}
                  {item.active && (
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-tv-brand rounded-r-tv-sm" />
                  )}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content Area - page custom sidebars are suppressed here */}
        <main className="flex-1 overflow-y-auto relative hide-internal-sidebar bg-tv-bg-primary">
          {children}
        </main>
      </div>
    </div>
  )
}
