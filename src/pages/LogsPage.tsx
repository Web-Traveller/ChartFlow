import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CandlestickChart, Compass, Plus, Terminal, RefreshCw, AlertCircle, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

interface LogEntry {
  timestamp: string
  source: 'backend' | 'frontend'
  level: 'info' | 'warning' | 'error'
  message: string
  context?: any
  stack?: string
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [limit, setLimit] = useState<number>(200)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const fetchLogs = () => {
    setIsLoading(true)
    setError('')
    const query = new URLSearchParams()
    if (levelFilter) query.append('level', levelFilter)
    if (sourceFilter) query.append('source', sourceFilter)
    query.append('limit', String(limit))

    fetch(`http://localhost:8000/1.1/logs?${query.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then(data => {
        setLogs(data)
      })
      .catch(err => {
        setError('Failed to fetch logs: ' + err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    fetchLogs()
  }, [levelFilter, sourceFilter, limit])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 3000)
    return () => clearInterval(interval)
  }, [autoRefresh, levelFilter, sourceFilter, limit])

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(idx)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts)
      return date.toLocaleTimeString() + ' ' + date.toLocaleDateString()
    } catch (e) {
      return ts
    }
  }

  const triggerError = () => {
    setTimeout(() => {
      throw new Error('This is a deliberately triggered frontend test error!');
    }, 10);
  }

  const triggerBackendError = () => {
    fetch('http://localhost:8000/1.1/trigger_error_test')
      .then(res => {
        if (!res.ok) {
          console.error("Backend error test request returned status:", res.status)
        }
      })
      .catch(err => {
        console.error("Backend error test request network failure:", err)
      })
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
          <Link to="/" className="flex items-center gap-3 text-tv-text-muted hover:text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Compass className="w-5 h-5" />
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
          <Link to="/logs" className="flex items-center gap-3 bg-tv-bg-tertiary border border-tv-border text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Terminal className="w-5 h-5 text-tv-brand" />
            App Logs
          </Link>
        </nav>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto flex flex-col">
        <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-tv-text-primary leading-tight">
              Centralized System Logs
            </h1>
            <p className="text-tv-text-muted text-lg max-w-2xl">
              Inspect warnings, errors, and informational events from both the FastAPI backend and React frontend.
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={triggerError}
              className="bg-tv-red/10 border border-tv-red/30 text-tv-red hover:bg-tv-red/20 px-4 py-2.5 rounded-tv-sm text-sm font-semibold transition-all hover:scale-105 cursor-pointer"
            >
              Trigger Frontend Error
            </button>
            <button
              onClick={triggerBackendError}
              className="bg-tv-red/10 border border-tv-red/30 text-tv-red hover:bg-tv-red/20 px-4 py-2.5 rounded-tv-sm text-sm font-semibold transition-all hover:scale-105 cursor-pointer"
            >
              Trigger Backend Error
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="bg-tv-bg-secondary border border-tv-border rounded-tv-xl p-5 mb-8 flex flex-col lg:flex-row gap-6 justify-between items-center backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            {/* Source Filter */}
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <label className="text-xs font-semibold text-tv-text-muted uppercase tracking-wider">Source</label>
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="bg-tv-bg-primary border border-tv-border rounded-tv-sm px-3 py-2 text-sm focus:outline-none focus:border-tv-brand text-tv-text-primary transition-colors"
              >
                <option value="">All Sources</option>
                <option value="backend">Backend</option>
                <option value="frontend">Frontend</option>
              </select>
            </div>

            {/* Level Filter */}
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <label className="text-xs font-semibold text-tv-text-muted uppercase tracking-wider">Level</label>
              <select
                value={levelFilter}
                onChange={e => setLevelFilter(e.target.value)}
                className="bg-tv-bg-primary border border-tv-border rounded-tv-sm px-3 py-2 text-sm focus:outline-none focus:border-tv-brand text-tv-text-primary transition-colors"
              >
                <option value="">All Levels</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>

            {/* Limit */}
            <div className="flex flex-col gap-1.5 min-w-[100px]">
              <label className="text-xs font-semibold text-tv-text-muted uppercase tracking-wider">Limit</label>
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="bg-tv-bg-primary border border-tv-border rounded-tv-sm px-3 py-2 text-sm focus:outline-none focus:border-tv-brand text-tv-text-primary transition-colors"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-6 w-full lg:w-auto justify-end">
            {/* Auto Refresh Toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none text-sm text-tv-text-muted font-medium">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="w-5 h-5 rounded border-tv-border bg-tv-bg-primary text-tv-brand focus:ring-tv-brand"
              />
              <span>Auto-refresh (3s)</span>
              <span className={`w-2.5 h-2.5 rounded-tv-full ${autoRefresh ? 'bg-tv-green animate-pulse' : 'bg-tv-text-muted'}`} />
            </label>

            {/* Manual Refresh */}
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="bg-tv-bg-primary border border-tv-border hover:border-tv-text-muted text-tv-text-primary p-2.5 rounded-tv-sm transition-all disabled:opacity-50 flex items-center gap-2 text-sm font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Logs Table Area */}
        {error && (
          <div className="mb-6 flex items-center gap-2 text-tv-red bg-tv-red/10 border border-tv-red/25 p-4 rounded-tv-sm text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-tv-bg-secondary border border-tv-border rounded-tv-xl flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto min-h-[400px]">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-20 text-tv-text-muted">
                <Terminal className="w-16 h-16 mb-4 text-tv-text-muted/60" />
                <p className="text-xl font-semibold">No logs matching query</p>
                <p className="text-sm mt-1">Logs are written dynamically. Try causing an action or changing filters.</p>
              </div>
            ) : (
              <div className="w-full">
                {/* Headers */}
                <div className="grid grid-cols-12 border-b border-tv-border bg-tv-bg-secondary/40 text-tv-text-muted text-xs font-semibold uppercase tracking-wider py-4 px-6 gap-4">
                  <div className="col-span-1"></div>
                  <div className="col-span-3">Timestamp</div>
                  <div className="col-span-2">Source</div>
                  <div className="col-span-2">Level</div>
                  <div className="col-span-4">Message</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-tv-border/40">
                  {logs.map((entry, idx) => {
                    const isExpanded = expandedIndex === idx
                    const hasDetails = (entry.context && Object.keys(entry.context).length > 0) || entry.stack

                    return (
                      <div key={idx} className={`hover:bg-tv-bg-tertiary/15 transition-colors ${isExpanded ? 'bg-tv-bg-tertiary/10' : ''}`}>
                        <div
                          className="grid grid-cols-12 py-3.5 px-6 gap-4 items-center text-sm cursor-pointer"
                          onClick={() => hasDetails && setExpandedIndex(isExpanded ? null : idx)}
                        >
                          <div className="col-span-1 flex items-center">
                            {hasDetails && (
                              isExpanded ? <ChevronDown className="w-4 h-4 text-tv-text-muted" /> : <ChevronRight className="w-4 h-4 text-tv-text-muted" />
                            )}
                          </div>
                          
                          {/* Timestamp */}
                          <div className="col-span-3 text-tv-text-muted font-mono text-xs">
                            {formatTimestamp(entry.timestamp)}
                          </div>

                          {/* Source */}
                          <div className="col-span-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-tv-full text-xs font-semibold border ${
                              entry.source === 'backend'
                                ? 'bg-tv-brand/10 text-tv-brand border-tv-brand/20'
                                : 'bg-tv-brand/20 text-tv-brand border border-tv-brand/30'
                            }`}>
                              {entry.source}
                            </span>
                          </div>

                          {/* Level */}
                          <div className="col-span-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-tv-full text-xs font-semibold border ${
                              entry.level === 'error'
                                ? 'bg-tv-red/10 text-tv-red border-tv-red/20'
                                : entry.level === 'warning'
                                ? 'bg-tv-brand/15 text-tv-brand border-tv-brand/20'
                                : 'bg-tv-green/10 text-tv-green border-tv-green/20'
                            }`}>
                              {entry.level}
                            </span>
                          </div>

                          {/* Message */}
                          <div className="col-span-4 text-tv-text-primary font-medium truncate" title={entry.message}>
                            {entry.message}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && hasDetails && (
                          <div className="bg-tv-bg-primary/80 border-y border-tv-border p-6 space-y-4">
                            {entry.context && Object.keys(entry.context).length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-tv-text-muted uppercase tracking-wide">Context</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      copyToClipboard(JSON.stringify(entry.context, null, 2), idx)
                                    }}
                                    className="text-xs text-tv-text-muted hover:text-tv-text-primary flex items-center gap-1 bg-tv-bg-secondary px-2 py-1 rounded-tv-sm border border-tv-border cursor-pointer"
                                  >
                                    {copiedId === idx ? <Check className="w-3.5 h-3.5 text-tv-green" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedId === idx ? 'Copied' : 'Copy JSON'}
                                  </button>
                                </div>
                                <pre className="bg-tv-bg-primary p-4 rounded-tv-sm border border-tv-border text-xs font-mono text-tv-text-primary overflow-x-auto max-h-60">
                                  {JSON.stringify(entry.context, null, 2)}
                                </pre>
                              </div>
                            )}

                            {entry.stack && (
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-tv-text-muted uppercase tracking-wide">Stack Trace</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      copyToClipboard(entry.stack || '', idx + 1000)
                                    }}
                                    className="text-xs text-tv-text-muted hover:text-tv-text-primary flex items-center gap-1 bg-tv-bg-secondary px-2 py-1 rounded-tv-sm border border-tv-border cursor-pointer"
                                  >
                                    {copiedId === idx + 1000 ? <Check className="w-3.5 h-3.5 text-tv-green" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedId === idx + 1000 ? 'Copied' : 'Copy Stack'}
                                  </button>
                                </div>
                                <pre className="bg-tv-bg-primary p-4 rounded-tv-sm border border-tv-border text-xs font-mono text-tv-red overflow-x-auto max-h-80 whitespace-pre">
                                  {entry.stack}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
