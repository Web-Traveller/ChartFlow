import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CandlestickChart, Play, Trash2, Calendar, ShieldCheck, Compass, AlertCircle, Plus, Terminal } from 'lucide-react'

interface Session {
  id: string
  name: string
  symbol: string
  all_instruments: boolean
  all_time: boolean
  time_start: string
  time_end: string
  created_at: number
}

interface SymbolSetting {
  name: string
  description: string
  exchange: string
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<{ [key: string]: Session }>({})
  const [symbols, setSymbols] = useState<{ [key: string]: SymbolSetting }>({})
  
  // Form fields
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('XAUUSD')
  const [allInstruments, setAllInstruments] = useState(false)
  const [allTime, setAllTime] = useState(true)
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Load sessions
    fetch('http://localhost:8000/1.1/sessions')
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(err => console.error('Failed to load sessions:', err))

    // Load symbols to list options
    fetch('http://localhost:8000/1.1/symbol_settings')
      .then(res => res.json())
      .then(data => setSymbols(data))
      .catch(err => console.error('Failed to load symbols:', err))
  }, [])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    // Form validation
    if (!name.strip()) {
      setStatus('error')
      setMessage('Session name is required')
      return
    }

    const payload = {
      name,
      symbol,
      all_instruments: allInstruments,
      all_time: allTime,
      time_start: allTime ? '' : timeStart,
      time_end: allTime ? '' : timeEnd
    }

    fetch('http://localhost:8000/1.1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setSessions(prev => ({ ...prev, [data.session.id]: data.session }))
          setStatus('success')
          setMessage('Session created successfully!')
          setName('')
        } else {
          setStatus('error')
          setMessage(data.message || 'Validation failed.')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Network error while creating session.')
      })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return

    fetch(`http://localhost:8000/1.1/sessions/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setSessions(prev => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        }
      })
      .catch(err => console.error('Error deleting session:', err))
  }

  // Symbol helper formatting
  const getSymbolLabel = (symName: string) => {
    const s = symbols[symName]
    return s ? `${symName} - ${s.description} (${s.exchange})` : symName
  }

  return (
    <div className="min-h-screen bg-tv-bg-primary text-tv-text-primary font-tv flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-tv-border bg-tv-bg-secondary/50 backdrop-blur flex flex-col p-6">
        <div className="flex items-center gap-2 mb-10">
          <CandlestickChart className="w-8 h-8 text-tv-brand" />
          <span className="text-xl font-bold text-tv-text-primary">
            ChartFlow
          </span>
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/" className="flex items-center gap-3 bg-tv-bg-tertiary border border-tv-border text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Compass className="w-5 h-5 text-tv-brand" />
            Dashboard
          </Link>
          <Link to="/chart" className="flex items-center gap-3 text-tv-text-muted hover:text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <CandlestickChart className="w-5 h-5" />
            Launch Chart
          </Link>
          <Link to="/settings" className="flex items-center gap-3 text-tv-text-muted hover:text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Plus className="w-5 h-5" />
            Settings & Import
          </Link>
          <Link to="/logs" className="flex items-center gap-3 text-tv-text-muted hover:text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Terminal className="w-5 h-5" />
            App Logs
          </Link>
        </nav>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto max-w-7xl">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-tv-text-primary leading-tight">
            Workspace Dashboard
          </h1>
          <p className="text-tv-text-muted text-lg max-w-2xl">
            Configure custom viewing scopes, constrain backtesting periods, and initialize standalone market sessions.
          </p>
        </div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Session Form */}
          <div className="lg:col-span-1 bg-tv-bg-secondary border border-tv-border rounded-tv-xl p-6 shadow-2xl h-fit">
            <h2 className="text-2xl font-bold mb-6 text-tv-text-primary">New Backtest Session</h2>
            <form onSubmit={handleCreate} className="space-y-5">
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-tv-text-muted">Session Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gold Jan-July 2021"
                  required
                  className="w-full bg-tv-bg-primary/80 border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary placeholder-tv-text-muted focus:outline-none focus:border-tv-brand transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-tv-text-muted">Select Symbol</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  disabled={allInstruments}
                  className="w-full bg-tv-bg-primary/80 border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors disabled:opacity-50"
                >
                  <option value="XAUUSD">{getSymbolLabel('XAUUSD')}</option>
                  <option value="XAGUSD">{getSymbolLabel('XAGUSD')}</option>
                  <option value="BTCUSD">{getSymbolLabel('BTCUSD')}</option>
                  {Object.keys(symbols).filter(s => s !== 'XAUUSD' && s !== 'XAGUSD' && s !== 'BTCUSD').map(s => (
                    <option key={s} value={s}>{getSymbolLabel(s)}</option>
                  ))}
                </select>
              </div>

              {/* Options */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allInstruments}
                    onChange={(e) => setAllInstruments(e.target.checked)}
                    className="w-5 h-5 rounded border-tv-border bg-tv-bg-primary text-tv-brand focus:ring-tv-brand"
                  />
                  <span className="text-sm text-tv-text-primary font-medium">All Instruments</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allTime}
                    onChange={(e) => setAllTime(e.target.checked)}
                    className="w-5 h-5 rounded border-tv-border bg-tv-bg-primary text-tv-brand focus:ring-tv-brand"
                  />
                  <span className="text-sm text-tv-text-primary font-medium">All Available Timeframe</span>
                </label>
              </div>

              {/* Date pickers (only shown if not allTime) */}
              {!allTime && (
                <div className="space-y-4 pt-2 border-t border-tv-border/50">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-tv-text-muted">Start Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                        required
                        className="w-full bg-tv-bg-primary/80 border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-tv-text-muted">End Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                        required
                        className="w-full bg-tv-bg-primary/80 border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Status Indicator */}
              {status === 'success' && (
                <div className="flex items-center gap-2 text-tv-green bg-tv-green/10 border border-tv-green/25 p-3.5 rounded-tv-md text-sm">
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <span>{message}</span>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-tv-red bg-tv-red/10 border border-tv-red/25 p-3.5 rounded-tv-md text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-tv-brand hover:bg-tv-brand-hover text-tv-text-primary font-bold py-4 rounded-tv-md transition-all hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                Create Session
              </button>

            </form>
          </div>

          {/* Active Sessions List */}
          <div className="lg:col-span-2 bg-tv-bg-secondary border border-tv-border rounded-tv-xl p-6 shadow-2xl flex flex-col min-h-[400px]">
            <h2 className="text-2xl font-bold mb-6 text-tv-text-primary">Active Viewing Sessions</h2>
            
            {Object.keys(sessions).length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-tv-text-muted">
                <Calendar className="w-12 h-12 mb-4 text-tv-text-muted/60" />
                <p className="text-lg">No active viewing sessions found.</p>
                <p className="text-sm">Create a session using the form on the left to start backtesting.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-tv-border text-tv-text-muted text-sm font-semibold">
                      <th className="pb-4 pr-4">Session Info</th>
                      <th className="pb-4 pr-4">Scope</th>
                      <th className="pb-4 pr-4">Date Range</th>
                      <th className="pb-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tv-border/50">
                    {Object.values(sessions)
                      .sort((a, b) => b.created_at - a.created_at)
                      .map((sess) => (
                        <tr key={sess.id} className="text-tv-text-primary hover:bg-tv-bg-tertiary/30 transition-colors">
                          <td className="py-4 pr-4">
                            <div className="font-semibold text-tv-text-primary">{sess.name}</div>
                            <div className="text-xs text-tv-text-muted font-mono">ID: {sess.id}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-tv-full text-xs font-semibold bg-tv-brand/10 text-tv-brand border border-tv-brand/20">
                              {sess.all_instruments ? 'All Symbols' : sess.symbol}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-sm font-mono text-tv-text-muted">
                            {sess.all_time ? (
                              <span className="text-tv-text-muted/60">All available data</span>
                            ) : (
                              `${sess.time_start} to ${sess.time_end}`
                            )}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <a
                                href={`/chart?session=${sess.id}`}
                                className="bg-tv-brand hover:bg-tv-brand-hover text-tv-text-primary font-semibold px-4.5 py-2 rounded-tv-sm transition-all text-sm flex items-center gap-1.5 hover:scale-105"
                              >
                                <Play className="w-4 h-4 fill-tv-text-primary text-tv-text-primary" />
                                Launch
                              </a>
                              <button
                                onClick={() => handleDelete(sess.id)}
                                className="bg-tv-bg-primary border border-tv-border hover:border-tv-red/30 text-tv-text-muted hover:text-tv-red p-2.5 rounded-tv-sm transition-all"
                                title="Delete Session"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// Simple helper polyfill for strings strip
if (!String.prototype.strip) {
  String.prototype.strip = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };
}

declare global {
  interface String {
    strip(): string;
  }
}
